import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Room from '../models/Room.model.js';
import Booking from '../models/Booking.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// --- YOUR NEW KEYS ---
const KEY_ID = 'rzp_test_RgpIoxFzAq82ro';
const KEY_SECRET = 'AnZJ1nYlLKAatVN39BMc4jYz';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

// --- 1. CREATE ORDER ---
router.post('/checkout', authMiddleware, async (req, res) => {
  const { roomId } = req.body;

  console.log(`--- INITIALIZING CHECKOUT FOR ROOM: ${roomId} ---`);

  try {
    const room = await Room.findById(roomId);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.pricePerYear) {
      return res.status(400).json({ message: 'Error: This room has no price set.' });
    }

    if (room.isOccupied) {
       return res.status(400).json({ message: 'Room is full' });
    }

    const options = {
      amount: Math.round(room.pricePerYear * 100), // Paisa
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: options.amount,
      currency: options.currency,
      room: room 
    });

  } catch (error) {
    console.error("❌ CHECKOUT ERROR:", error);
    // This is where the 500 error was coming from previously
    res.status(500).json({ message: 'Payment Init Failed: ' + error.message });
  }
});

// --- 2. VERIFY & BOOK ---
router.post('/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roomId } = req.body;

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    // Generate signature using YOUR NEW SECRET
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid Payment Signature' });
    }

    // Payment Verified - Save to DB
    const room = await Room.findById(roomId);
    
    const newBooking = new Booking({
      student: req.user.userId,
      room: roomId,
      status: 'active', // Must be lowercase and valid enum: 'pending', 'active', or 'checked-out'
      checkInDate: new Date(), // Set check-in date to now
    });

    await newBooking.save();
    
    room.occupants.push(req.user.userId);
    if (room.occupants.length >= room.capacity) {
      room.isOccupied = true;
    }
    await room.save();

    res.json({ message: 'Booking Successful', bookingId: newBooking._id });

  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ message: 'Booking failed: ' + error.message });
  }
});

export default router;