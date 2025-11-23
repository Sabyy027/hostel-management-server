import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import Booking from '../models/Booking.model.js';
import Room from '../models/Room.model.js'; // We need this to update the room status
import Notification from '../models/Notification.model.js';

const router = express.Router();

// --- CHECK BOOKING STATUS (for Students) ---
// @route   GET /api/bookings/status
// @desc    Check if student has any booking
// @access  Private (Student)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findOne({ student: req.user.userId });
    res.json({ hasBooking: !!booking });
  } catch (error) {
    console.error('Error checking booking status:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- GET MY BOOKING (for Students) ---
// @route   GET /api/bookings/my
// @desc    Get the logged-in student's booking
// @access  Private (Student)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findOne({ student: req.user.userId })
                                 .populate('room'); // Get the room details

    if (!booking) {
      return res.status(200).json({ message: 'No booking found.' });
    }
    res.status(200).json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- CREATE MY BOOKING (for Students) ---
// @route   POST /api/bookings
// @desc    Create a new booking by selecting a room
// @access  Private (Student)
router.post('/', authMiddleware, async (req, res) => {
  const { roomId } = req.body;
  const studentId = req.user.userId;

  if (!roomId) {
    return res.status(400).json({ message: 'Room ID is required.' });
  }

  try {
    // 1. Check if the room is available
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    if (room.isOccupied) {
      return res.status(409).json({ message: 'This room is already occupied.' });
    }

    // 2. Check if student already has a booking
    const existingBooking = await Booking.findOne({ student: studentId });
    if (existingBooking) {
      return res.status(409).json({ message: 'You already have an active booking.' });
    }

    // 3. Create the booking
    const newBooking = new Booking({
      student: studentId,
      room: roomId,
      // checkInDate is set by default
    });
    await newBooking.save();

    // 4. Update the room to be occupied
    room.isOccupied = true;
    await room.save();

    // 5. Create in-app notification for booking confirmation
    await Notification.create({
      user: studentId,
      type: 'Booking',
      message: `Your room booking has been confirmed! Room Number: ${room.roomNumber}`
    });
    
    // Populate the room details in the response
    const populatedBooking = await newBooking.populate('room');
    res.status(201).json(populatedBooking);

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// --- GET ALL BOOKINGS (for Admins) ---
// @route   GET /api/bookings
// @desc    Get all bookings
// @access  Private (Admin)
router.get('/', authMiddleware, async (req, res) => {
  // We can re-use the auth middleware, but we should add an admin check
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }

  try {
    const bookings = await Booking.find()
                                  .populate('student', 'username email')
                                  .populate('room', 'roomNumber roomType');
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;