import express from 'express';
import Query from '../models/Query.model.js';
import Booking from '../models/Booking.model.js';
import User from '../models/User.model.js';
import authMiddleware from '../middleware/auth.middleware.js';
import Notification from '../models/Notification.model.js';
import { sendTicketCreatedEmail, sendTicketStatusUpdateEmail, sendTicketAssignedToStaffEmail } from '../utils/email.js';
import upload from '../middleware/multer.middleware.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

const router = express.Router();

// --- 1. CREATE COMPLAINT (Student/Resident) with optional image ---
router.post('/', [authMiddleware, upload.single('image')], async (req, res) => {
  const { category, title, description, priority } = req.body;
  try {
    // Find active booking
    const booking = await Booking.findOne({ 
      student: req.user.userId, 
      // Using lowercase 'active' as per your DB fix earlier, and others just in case
      status: { $in: ['Pending', 'Active', 'active', 'CheckedIn', 'Paid'] } 
    });

    if (!booking) return res.status(400).json({ message: 'No active booking found.' });

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (req.file) {
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          'complaints'
        );
        imageUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue without image if upload fails
      }
    }

    const newComplaint = new Query({
      student: req.user.userId,
      room: booking.room,
      category, 
      title, 
      description, 
      priority,
      imageUrl
    });

    await newComplaint.save();

    // Create in-app notification for complaint creation
    await Notification.create({
      user: req.user.userId,
      type: 'Query',
      message: `Your complaint "${title}" has been submitted successfully. Priority: ${priority}`
    });

    // Send email to student confirming complaint creation
    const student = await User.findById(req.user.userId);
    if (student && student.email) {
      const populatedComplaint = await Query.findById(newComplaint._id).populate('room', 'roomNumber');
      await sendTicketCreatedEmail(student.email, student.username, {
        title,
        category,
        priority,
        ticketId: newComplaint._id.toString().slice(-6).toUpperCase()
      });
    }

    res.status(201).json(newComplaint);
  } catch (error) {
    res.status(500).json({ message: 'Error creating complaint: ' + error.message });
  }
});

// --- 2. GET QUERIES (Admin sees all, Staff sees assigned, Students CANNOT see any) ---
router.get('/all', authMiddleware, async (req, res) => {
  try {
    let filter = {};
    
    // Only Admin and Staff can view complaints
    if (req.user.role === 'student') {
      return res.status(403).json({ message: 'Students cannot view complaints list. Complaints are visible to admin only.' });
    }
    
    if (req.user.role === 'staff') {
      filter = { assignedTo: req.user.userId }; // Staff only see their assigned work
    }
    // Admin sees everything (empty filter)

    const complaints = await Query.find(filter)
      .populate('student', 'username')
      .populate({ path: 'room', select: 'roomNumber' })
      .populate('assignedTo', 'username designation')
      .sort({ createdAt: -1 });
    
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching complaints' });
  }
});

// --- 3. ASSIGN STAFF (Admin Only) ---
router.put('/assign/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  
  const { staffId } = req.body;
  try {
    const complaint = await Query.findByIdAndUpdate(
      req.params.id,
      { assignedTo: staffId, status: 'Assigned' },
      { new: true }
    )
    .populate('assignedTo', 'username email')
    .populate('student', 'username email')
    .populate('room', 'roomNumber');

    // Create in-app notification for assigned staff
    if (complaint.assignedTo) {
      await Notification.create({
        user: complaint.assignedTo._id,
        type: 'Query',
        message: `New complaint assigned to you: "${complaint.title}" (${complaint.category}) - Priority: ${complaint.priority}`
      });
    }

    // Create in-app notification for student
    if (complaint.student) {
      await Notification.create({
        user: complaint.student._id,
        type: 'Query',
        message: `Your complaint "${complaint.title}" has been assigned to ${complaint.assignedTo?.username || 'staff'}`
      });
    }

    // Send email to assigned staff member
    if (complaint.assignedTo && complaint.assignedTo.email) {
      await sendTicketAssignedToStaffEmail(complaint.assignedTo.email, complaint.assignedTo.username, {
        title: complaint.title,
        category: complaint.category,
        priority: complaint.priority,
        description: complaint.description,
        roomNumber: complaint.room?.roomNumber || 'N/A',
        studentName: complaint.student?.username || 'Unknown'
      });
    }

    // Send email to student notifying assignment
    if (complaint.student && complaint.student.email) {
      await sendTicketStatusUpdateEmail(complaint.student.email, complaint.student.username, {
        title: complaint.title,
        status: 'Assigned',
        ticketId: complaint._id.toString().slice(-6).toUpperCase(),
        assignedStaff: complaint.assignedTo?.username || 'Staff Member'
      });
    }
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Assignment failed' });
  }
});

// --- 4. UPDATE STATUS (Staff/Admin) ---
router.put('/status/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    const updateData = { status };
    if (status === 'Resolved') updateData.resolvedDate = new Date();

    const complaint = await Query.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('student', 'username email')
      .populate('assignedTo', 'username');
    
    // Send in-app notification to student when status changes
    if (req.user.role === 'staff' || req.user.role === 'admin') {
      await Notification.create({
        user: complaint.student._id,
        type: 'Query',
        message: `Your complaint "${complaint.title}" status is now: ${status}`
      });

      // Send email notification
      if (complaint.student && complaint.student.email) {
        await sendTicketStatusUpdateEmail(complaint.student.email, complaint.student.username, {
          title: complaint.title,
          status: status,
          ticketId: complaint._id.toString().slice(-6).toUpperCase(),
          assignedStaff: complaint.assignedTo?.username || null
        });
      }
    }
    
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
});

export default router;