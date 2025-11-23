import express from 'express';
import Booking from '../models/Booking.model.js';
import Invoice from '../models/Invoice.model.js';
import Room from '../models/Room.model.js';
import User from '../models/User.model.js';
import Profile from '../models/Profile.model.js';
import Query from '../models/Query.model.js';
import authMiddleware, { managerOnly, adminOnly } from '../middleware/auth.middleware.js';

const router = express.Router();

// --- 1. ADMIN: CHECK-IN RESIDENT ---
router.post('/check-in/:bookingId', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    booking.status = 'CheckedIn';
    booking.checkInDate = new Date(); // Set actual arrival time
    await booking.save();
    
    res.json({ message: 'Resident successfully Checked In', booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- 2. ADMIN: CHECK-OUT RESIDENT ---
router.post('/check-out/:bookingId', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    // 1. Update Booking Status
    booking.status = 'CheckedOut';
    booking.checkOutDate = new Date();
    await booking.save();

    // 2. Free up the Room
    await Room.findByIdAndUpdate(booking.room, {
      $pull: { occupants: booking.student },
      // Optional: You might want to set isOccupied=false if occupants.length becomes 0
    });
    
    // Note: We might want to explicitly check if room is empty to set isOccupied: false
    const room = await Room.findById(booking.room);
    if (room.occupants.length < room.capacity) {
        room.isOccupied = false;
        await room.save();
    }

    res.json({ message: 'Resident successfully Checked Out', booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- 3. ADMIN: RESIDENT 360° DASHBOARD DATA ---
// Fetches User + Room + Tickets + Pending Dues + Profile + RT
router.get('/dashboard-view', [authMiddleware, managerOnly], async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('username email gender');
    const Floor = (await import('../models/Floor.model.js')).default;
    const Block = (await import('../models/Block.model.js')).default;

    const fullData = await Promise.all(students.map(async (student) => {
      // Get Profile Data
      const profile = await Profile.findOne({ user: student._id });

      // Get Active Booking with full room details
      const booking = await Booking.findOne({ 
        student: student._id, 
        status: { $in: ['CheckedIn', 'Active', 'Paid', 'Pending'] } 
      }).populate({ 
        path: 'room', 
        populate: { path: 'floor' }
      });

      let roomDetails = null;
      let floorDetails = null;
      let blockDetails = null;
      let assignedRT = null;

      if (booking && booking.room) {
        roomDetails = {
          roomNumber: booking.room.roomNumber,
          type: booking.room.type,
          capacity: booking.room.capacity
        };

        if (booking.room.floor) {
          const floor = await Floor.findById(booking.room.floor).populate('assignedRT', 'username email');
          const block = await Block.findById(floor.block);
          
          floorDetails = {
            _id: floor._id,
            name: floor.name,
            number: floor.number
          };

          blockDetails = {
            _id: block._id,
            name: block.name
          };

          assignedRT = floor.assignedRT ? {
            _id: floor.assignedRT._id,
            name: floor.assignedRT.username,
            email: floor.assignedRT.email
          } : null;
        }
      }

      // Get Active Complaints Count
      const activeTickets = await Query.countDocuments({ 
        student: student._id, 
        status: { $ne: 'Resolved' } 
      });

      // Get Financials (Pending Dues)
      const invoices = await Invoice.find({ student: student._id, status: 'Pending' });
      const pendingDues = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

      // Determine resident type based on gender
      const residentType = student.gender || (profile?.address?.city ? 'Local' : 'Unknown');

      // Check booking status
      const isActive = booking && ['CheckedIn', 'Active'].includes(booking.status);
      const isVacated = booking && booking.status === 'CheckedOut';

      return {
        _id: student._id,
        name: student.username,
        email: student.email,
        gender: student.gender,
        residentType: residentType,
        profile: {
          phoneNumber: profile?.phoneNumber || 'N/A',
          address: profile?.address || {},
          age: student.age || 'N/A'
        },
        room: roomDetails,
        floor: floorDetails,
        block: blockDetails,
        assignedRT: assignedRT,
        checkInDate: booking?.checkInDate || null,
        status: isVacated ? 'Vacated' : isActive ? 'Active' : 'Pending',
        activeTickets, 
        pendingDues    
      };
    }));

    res.json(fullData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching dashboard data' });
  }
});

// --- 4. STUDENT: GET MY INVOICES ---
router.get('/my-invoices', authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({ student: req.user.userId }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;