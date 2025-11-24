import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import authMiddleware from '../middleware/auth.middleware.js';
import Booking from '../models/Booking.model.js';
import Invoice from '../models/Invoice.model.js';
import Query from '../models/Query.model.js';
import User from '../models/User.model.js';
import Floor from '../models/Floor.model.js';
import Block from '../models/Block.model.js';
import Room from '../models/Room.model.js';

const router = express.Router();

// --- CONFIGURATION ---
// The client gets the API key from the environment variable
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// --- HELPER: LOAD RAG DATA (Static Rules) ---
const getKnowledgeBase = () => {
  try {
    const filePath = path.join(process.cwd(), 'knowledgebase.txt');
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error("❌ RAG Error:", err);
    return "Hostel Rules: Standard strict rules apply.";
  }
};

// --- HELPER: GET USER CONTEXT (Dynamic DB Data) ---
async function getUserContext(userId, userRole) {
  try {
    // STUDENT CONTEXT
    if (userRole === 'student') {
      // 1. Get Room Info
      const booking = await Booking.findOne({ 
        student: userId, 
        status: { $in: ['Active', 'CheckedIn', 'Paid', 'Pending', 'active'] } 
      }).populate({ path: 'room', select: 'roomNumber type' });

      // 2. Get Pending Dues
      const pendingInvoices = await Invoice.find({ student: userId, status: 'Pending' });
      const totalDue = pendingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

      // 3. Get Open Complaints/Queries
      const activeComplaints = await Query.find({ 
        student: userId, 
        status: { $ne: 'Resolved' } 
      }).select('category status title');

      return {
        role: 'Student',
        room: booking ? `Room ${booking.room.roomNumber} (${booking.room.type})` : "No active room booking",
        dues: totalDue > 0 ? `₹${totalDue} Pending` : "All dues cleared ✓",
        complaints: activeComplaints.length > 0 
          ? activeComplaints.map(t => `${t.category}: ${t.title} (${t.status})`).join(", ") 
          : "No active complaints"
      };
    }
    
    // STAFF CONTEXT
    else if (userRole === 'staff') {
      // Get assigned tasks
      const assignedTasks = await Query.find({ 
        assignedTo: userId 
      }).select('category status title priority');
      
      const pendingTasks = assignedTasks.filter(t => t.status === 'Pending').length;
      const inProgressTasks = assignedTasks.filter(t => t.status === 'In Progress').length;
      const resolvedTasks = assignedTasks.filter(t => t.status === 'Resolved').length;
      
      return {
        role: 'Staff',
        totalTasks: assignedTasks.length,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        resolved: resolvedTasks,
        recentTasks: assignedTasks.slice(0, 5).map(t => `${t.category}: ${t.title} (${t.status})`).join(", ")
      };
    }
    
    // RESIDENT TUTOR CONTEXT
    else if (userRole === 'warden' || userRole === 'resident tutor') {
      // Check if this is specifically an RT by checking designation
      const rtUser = await User.findById(userId).populate('assignedFloors');
      
      if (rtUser && rtUser.designation === 'Resident Tutor') {
        // RT-specific context with floor assignments
        const assignedFloors = rtUser.assignedFloors || [];
        
        if (assignedFloors.length === 0) {
          return {
            role: 'Resident Tutor',
            message: 'No floors assigned yet',
            assignedFloors: [],
            totalRooms: 0,
            occupiedRooms: 0
          };
        }

        // Get detailed floor information
        const floorDetails = await Floor.find({ 
          _id: { $in: assignedFloors.map(f => f._id || f) } 
        }).populate('block');

        // Get room counts for each floor
        let totalRooms = 0;
        let occupiedRooms = 0;
        const floorInfo = [];

        for (const floor of floorDetails) {
          const rooms = await Room.find({ floor: floor._id });
          const occupied = await Booking.countDocuments({
            room: { $in: rooms.map(r => r._id) },
            status: { $in: ['Active', 'CheckedIn', 'Paid'] }
          });

          totalRooms += rooms.length;
          occupiedRooms += occupied;

          // Count Pending Check-ins
          const pending = await Booking.countDocuments({
            room: { $in: rooms.map(r => r._id) },
            status: 'Pending'
          });

          floorInfo.push({
            name: floor.name,
            number: floor.number,
            block: floor.block?.name || 'Unknown Block',
            type: floor.type,
            totalRooms: rooms.length,
            occupiedRooms: occupied,
            pendingCheckins: pending,
            availableRooms: rooms.length - occupied - pending
          });
        }

        // Get queries from RT's floors
        const floorStudents = await Booking.find({
          room: { $in: await Room.find({ floor: { $in: floorDetails.map(f => f._id) } }).distinct('_id') },
          status: { $in: ['Active', 'CheckedIn', 'Paid'] }
        }).distinct('student');

        const pendingQueries = await Query.countDocuments({
          student: { $in: floorStudents },
          status: { $ne: 'Resolved' }
        });

        return {
          role: 'Resident Tutor',
          assignedFloorsCount: floorDetails.length,
          floors: floorInfo,
          totalRooms,
          occupiedRooms,
          availableRooms: totalRooms - occupiedRooms,
          studentsUnderCare: floorStudents.length,
          pendingQueries
        };
      }

      // Warden context (non-RT)
      const totalRegisteredStudents = await User.countDocuments({ role: 'student' });
      const totalActiveResidents = await Booking.countDocuments({ status: { $in: ['Active', 'CheckedIn', 'Paid'] } });
      const totalPendingCheckins = await Booking.countDocuments({ status: 'Pending' });
      
      const totalPendingQueries = await Query.countDocuments({ status: { $ne: 'Resolved' } });
      const highPriorityQueries = await Query.countDocuments({ priority: 'High', status: { $ne: 'Resolved' } });
      const totalPendingDues = await Invoice.aggregate([
        { $match: { status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      
      return {
        role: 'Warden',
        totalRegisteredStudents,
        totalActiveResidents,
        totalPendingCheckins,
        pendingQueries: totalPendingQueries,
        highPriority: highPriorityQueries,
        totalDues: totalPendingDues.length > 0 ? `₹${totalPendingDues[0].total}` : '₹0'
      };
    }
    
    // ADMIN CONTEXT
    else if (userRole === 'admin') {
      // System-wide statistics
      const totalRegisteredStudents = await User.countDocuments({ role: 'student' });
      const totalActiveResidents = await Booking.countDocuments({ status: { $in: ['Active', 'CheckedIn', 'Paid'] } });
      const totalPendingCheckins = await Booking.countDocuments({ status: 'Pending' });

      const totalPendingQueries = await Query.countDocuments({ status: { $ne: 'Resolved' } });
      const highPriorityQueries = await Query.countDocuments({ priority: 'High', status: { $ne: 'Resolved' } });
      const totalPendingDues = await Invoice.aggregate([
        { $match: { status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      
      return {
        role: 'Administrator',
        totalRegisteredStudents,
        totalActiveResidents,
        totalPendingCheckins,
        pendingQueries: totalPendingQueries,
        highPriority: highPriorityQueries,
        totalDues: totalPendingDues.length > 0 ? `₹${totalPendingDues[0].total}` : '₹0'
      };
    }

    return { role: 'User' };
  } catch (error) {
    console.error("Error fetching user context:", error);
    return { role: 'Unknown', error: 'Unable to fetch context' };
  }
}

// --- GET CURRENT DAY ---
function getCurrentDay() {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date().getDay()];
}

// --- CHAT ROUTE ---
router.post('/chat', authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ reply: "Please send a message." });
  }

  try {
    // 1. RETRIEVE: Load the Rulebook & Menu
    const knowledgeBase = getKnowledgeBase();

    // 2. CONTEXT: Load User's Live Data
    const userContext = await getUserContext(req.user.userId, req.user.role);
    const currentDay = getCurrentDay();

    // 3. AUGMENT: Create Role-Specific Prompts
    let systemInstruction = '';
    
    // STUDENT PROMPT
    if (req.user.role === 'student') {
      systemInstruction = `
        You are 'HostelBot', the smart AI Assistant for hostel management. 
        
        --- SOURCE 1: HOSTEL RULEBOOK & MESS MENU ---
        ${knowledgeBase}
        ---------------------------------------------

        --- SOURCE 2: STUDENT PROFILE (LIVE DATA) ---
        Student Name: ${req.user.username}
        Current Room: ${userContext.room}
        Financial Status: ${userContext.dues}
        Active Complaints: ${userContext.complaints}
        Today is: ${currentDay}
        ---------------------------------------------

        INSTRUCTIONS:
        - CRITICAL: Write responses in plain natural text WITHOUT any markdown formatting.
        - DO NOT use asterisks (**), hyphens (-), numbered lists, or bullet points.
        - Write like a friendly assistant having a normal conversation.
        - Answer questions using the Rulebook (Source 1) AND the Student's Live Data (Source 2).
        - If asked about "Mess", "Food", or "Menu", check today's (${currentDay}) menu in Source 1 and respond naturally.
        - If asked about "Dues", "Room", or "Complaints", refer to Source 2 (Live Data).
        - If asked about rules, policies, timings, or facilities, use Source 1.
        - Keep answers friendly, short (2-3 sentences), and conversational.
        - Use emojis naturally within sentences (🏠 🍽️ 💰 🔧) but don't overuse them.
        - If you don't know something, suggest contacting the warden or office naturally.
        - If student asks about creating a complaint, guide them conversationally to use the "Complaints" page.
        - Example good: "Hey! You're in Room 101 and everything looks good. No dues pending right now!"
        - Example BAD: "**Room:** 101" (Don't format like this!)
      `;
    }
    
    // STAFF PROMPT
    else if (req.user.role === 'staff') {
      systemInstruction = `
        You are 'HostelBot', the AI Assistant for hostel staff management.
        
        --- SOURCE 1: HOSTEL RULEBOOK & MESS MENU ---
        ${knowledgeBase}
        ---------------------------------------------

        --- SOURCE 2: STAFF PROFILE (LIVE DATA) ---
        Staff Name: ${req.user.username}
        Total Assigned Tasks: ${userContext.totalTasks}
        Pending Tasks: ${userContext.pending}
        In Progress: ${userContext.inProgress}
        Resolved: ${userContext.resolved}
        Recent Tasks: ${userContext.recentTasks || 'None'}
        Today is: ${currentDay}
        ---------------------------------------------

        INSTRUCTIONS:
        - CRITICAL: Write responses in plain natural text WITHOUT any markdown formatting.
        - DO NOT use asterisks (**), hyphens (-), or any special formatting.
        - Write conversationally like you're talking to a colleague.
        - Answer questions about hostel rules, mess menu, and staff-related queries naturally.
        - Provide task status and workload information from Source 2 in a friendly way.
        - Help staff understand their responsibilities and priorities.
        - If asked about today's menu, check ${currentDay} in Source 1 and respond conversationally.
        - Keep answers professional but friendly, use emojis naturally (🔧 📋 ✅).
        - Suggest they check the "My Tasks" page naturally like "You can see all details on the My Tasks page!"
      `;
    }
    
    // RESIDENT TUTOR PROMPT
    else if ((req.user.role === 'warden' || req.user.role === 'resident tutor') && userContext.role === 'Resident Tutor') {
      // Format floor details for display
      const floorsList = userContext.floors?.map(f => 
        `${f.name} (${f.block}) - ${f.type}: ${f.totalRooms} rooms (${f.occupiedRooms} occupied, ${f.pendingCheckins} pending check-in, ${f.availableRooms} available)`
      ).join('\n        ') || 'None assigned';

      systemInstruction = `
        You are 'HostelBot', the AI Assistant for Resident Tutors.
        
        --- SOURCE 1: HOSTEL RULEBOOK & MESS MENU ---
        ${knowledgeBase}
        ---------------------------------------------

        --- SOURCE 2: RESIDENT TUTOR PROFILE (LIVE DATA) ---
        Resident Tutor: ${req.user.username}
        Assigned Floors Count: ${userContext.assignedFloorsCount || 0}
        
        Assigned Floors Details:
        ${floorsList}
        
        Summary:
        - Total Rooms Under Care: ${userContext.totalRooms || 0}
        - Occupied Rooms: ${userContext.occupiedRooms || 0}
        - Available Rooms: ${userContext.availableRooms || 0}
        - Students Under Care: ${userContext.studentsUnderCare || 0}
        - Pending Student Queries: ${userContext.pendingQueries || 0}
        
        Today is: ${currentDay}
        ---------------------------------------------

        INSTRUCTIONS:
        - You are assisting a Resident Tutor who manages specific floors.
        - CRITICAL: Write responses in plain natural text WITHOUT any markdown formatting.
        - DO NOT use asterisks (**), hyphens (-), or any special formatting characters.
        - Write like you're having a normal conversation, not writing documentation.
        - When listing floors, use simple sentences like: "You're assigned to Floor 1 in Block A (Non-AC) with 8 rooms. Currently all 8 are available."
        - When providing multiple items, separate them with periods or commas, NOT bullet points or numbered lists.
        - Use emojis naturally within sentences (like 🏠 or 👥) but don't overuse them.
        - Keep responses conversational, friendly, and easy to read.
        - When asked "What floors am I assigned to?", provide the floor details naturally in 2-3 sentences.
        - Example good response: "Hey! You're currently managing Floor 1 in Block A, which has 8 Non-AC rooms. Right now all 8 rooms are available and you have no students yet. You don't have any pending queries to handle."
        - Example BAD response: "**Floor 1** - 8 rooms" (Don't use markdown!)
        - For mess menu questions, check ${currentDay} in Source 1 and respond conversationally.
        - Suggest checking pages naturally like "You can see this visually on the Occupancy Dashboard if you want!"
      `;
    }
    
    // WARDEN/ADMIN PROMPT
    else if (req.user.role === 'admin' || req.user.role === 'warden') {
      systemInstruction = `
        You are 'HostelBot', the AI Assistant for hostel administrators.
        
        --- SOURCE 1: HOSTEL RULEBOOK & MESS MENU ---
        ${knowledgeBase}
        ---------------------------------------------

        --- SOURCE 2: SYSTEM OVERVIEW (LIVE DATA) ---
        Administrator: ${req.user.username}
        Role: ${userContext.role || 'Administrator'}
        Total Registered Students: ${userContext.totalRegisteredStudents}
        Active Residents (Checked-in): ${userContext.totalActiveResidents}
        Pending Check-ins: ${userContext.totalPendingCheckins}
        Pending Queries: ${userContext.pendingQueries}
        High Priority Issues: ${userContext.highPriority || 0}
        Total Pending Dues: ${userContext.totalDues}
        Today is: ${currentDay}
        ---------------------------------------------

        INSTRUCTIONS:
        - CRITICAL: Write responses in plain natural text WITHOUT any markdown formatting.
        - DO NOT use asterisks (**), hyphens (-), bullet points, or numbered lists.
        - Write conversationally but professionally, like talking to a senior colleague.
        - Provide system-wide insights and administrative information naturally.
        - Answer questions about hostel statistics, occupancy, financials, and operations in simple sentences.
        - Help with policy decisions by referencing the rulebook in Source 1.
        - Provide menu information for ${currentDay} when asked, naturally.
        - Use emojis naturally (📊 🏢 💼) but keep it professional.
        - For detailed reports, suggest pages naturally like "Check out the Reports Dashboard for detailed analytics!"
        - For specific student queries, suggest conversationally: "You can find student details in the Resident Manager page."
        - For financial details, mention naturally: "The Billing Dashboard has all the financial breakdowns."
        - Example good: "You have 150 registered students. 140 are currently active residents and 10 are pending check-in. There are 12 pending queries."
        - Example BAD: "**Students:** 150" (Don't format like this!)
      `;
    }

    // 4. GENERATE: Call Gemini
    const fullPrompt = `${systemInstruction}\n\nQuestion: ${message}\n\nYour Response:`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: fullPrompt,
    });

    res.json({ reply: response.text });

  } catch (error) {
    console.error("❌ AI Error:", error);
    
    // Better error handling
    if (error.message && error.message.includes('API key')) {
      res.status(500).json({ reply: "AI service configuration error. Please contact the administrator." });
    } else if (error.message && error.message.includes('quota')) {
      res.status(500).json({ reply: "AI service is temporarily unavailable due to high usage. Please try again in a few minutes." });
    } else {
      res.status(500).json({ reply: "I'm currently experiencing technical difficulties. Please contact the warden or try again later. 🔧" });
    }
  }
});

// --- HEALTH CHECK ROUTE ---
router.get('/health', async (req, res) => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  const knowledgeBaseExists = fs.existsSync(path.join(process.cwd(), 'knowledgebase.txt'));
  
  // Test API connectivity
  let apiStatus = 'untested';
  try {
    const testResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: "Hello",
    });
    apiStatus = testResponse.text ? 'working' : 'error';
  } catch (error) {
    apiStatus = `error: ${error.message}`;
  }
  
  res.json({
    status: hasApiKey && knowledgeBaseExists ? 'ready' : 'not configured',
    apiKey: hasApiKey ? 'configured' : 'missing',
    knowledgeBase: knowledgeBaseExists ? 'loaded' : 'missing',
    apiConnection: apiStatus
  });
});

export default router;
