import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Room from '../models/Room.model.js';
import Booking from '../models/Booking.model.js';
import authMiddleware from '../middleware/auth.middleware.js';
import Invoice from '../models/Invoice.model.js';
import User from '../models/User.model.js';
import Profile from '../models/Profile.model.js'; // <--- Added Profile Import
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';
import { generateMessPassPDF } from '../utils/messPassGenerator.js';
import { sendBookingConfirmation, sendServicePurchaseEmail, sendFinePaymentConfirmationEmail } from '../utils/email.js';
import Service from '../models/Service.model.js';
import StudentService from '../models/StudentService.model.js';
import Notification from '../models/Notification.model.js';

const router = express.Router();

// --- RAZORPAY CONFIGURATION (from environment variables) ---
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.error('❌ ERROR: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not found in environment variables!');
  process.exit(1);
}

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

// --- 1. CREATE ORDER ---
router.post('/checkout', authMiddleware, async (req, res) => {
  const { roomId, planId } = req.body;

  console.log(`--- INITIALIZING CHECKOUT FOR ROOM: ${roomId} ---`);

  try {
    const room = await Room.findById(roomId);
    
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.isOccupied) return res.status(400).json({ message: 'Room is full' });

    // Safety check
    if (!room.pricingPlans || room.pricingPlans.length === 0) {
      return res.status(400).json({ message: 'Error: No pricing plans configured.' });
    }

    // Find Plan
    const selectedPlan = room.pricingPlans.id(planId);
    if (!selectedPlan) return res.status(400).json({ message: 'Invalid Pricing Plan selected.' });

    const options = {
      amount: Math.round(selectedPlan.price * 100), 
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
    console.error("Checkout Error:", error);
    res.status(500).json({ message: 'Payment Init Failed: ' + error.message });
  }
});

// --- 2. VERIFY & BOOK & INVOICE ---
router.post('/verify', authMiddleware, async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature, 
    roomId, 
    planId,
    residentDetails // <--- Receive Form Data from Frontend
  } = req.body; 

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid Payment Signature' });
    }

    // --- A. FETCH DATA ---
    const room = await Room.findById(roomId);
    const selectedPlan = room.pricingPlans.id(planId);

    // --- B. SAVE PROFILE DATA ---
    // 1. Update Gender in User Model
    if (residentDetails?.gender) {
      await User.findByIdAndUpdate(req.user.userId, { gender: residentDetails.gender });
    }

    // 2. Calculate age from DOB
    let calculatedAge = null;
    if (residentDetails.dob) {
      const birthDate = new Date(residentDetails.dob);
      const today = new Date();
      calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
    }

    // 3. Update/Create Profile (Address, Phone, DOB, Age, Gender, etc.)
    await Profile.findOneAndUpdate(
      { user: req.user.userId },
      {
        user: req.user.userId,
        fullName: residentDetails.fullName,
        dateOfBirth: residentDetails.dob,
        age: calculatedAge,
        gender: residentDetails.gender,
        phoneNumber: residentDetails.mobileNumber,
        altPhone: residentDetails.altPhone,
        address: {
          street: residentDetails.street,
          city: residentDetails.city,
          state: residentDetails.state,
          zipCode: residentDetails.pincode
        }
      },
      { upsert: true, new: true }
    );

    // --- C. CREATE BOOKING ---
    const newBooking = new Booking({
      student: req.user.userId,
      room: roomId,
      totalAmount: selectedPlan.price, // <--- Ensure Total Amount is saved
      paymentStatus: 'Paid',
      status: 'Pending', // Pending physical arrival
      checkInDate: residentDetails.checkInDate, // <--- Use Date from Form
      academicYear: '2025-2026',
      duration: `${selectedPlan.duration} ${selectedPlan.unit}`,
      residentDetails: {
        fullName: residentDetails.fullName,
        dob: residentDetails.dob,
        gender: residentDetails.gender,
        mobileNumber: residentDetails.mobileNumber,
        altPhone: residentDetails.altPhone,
        address: residentDetails.address,
        street: residentDetails.street,
        city: residentDetails.city,
        state: residentDetails.state,
        pincode: residentDetails.pincode
      }
    });

    await newBooking.save();
    
    // --- D. CREATE INVOICE (DB RECORD) ---
    const invoiceId = `INV-${Date.now()}`;
    await Invoice.create({
      student: req.user.userId,
      booking: newBooking._id,
      invoiceId: invoiceId,
      totalAmount: selectedPlan.price,
      status: 'Paid',
      paidAt: new Date()
    });

    // --- E. UPDATE ROOM OCCUPANCY ---
    room.occupants.push(req.user.userId);
    if (room.occupants.length >= room.capacity) {
      room.isOccupied = true;
    }
    await room.save();

    // --- F. GENERATE PDF & EMAIL ---
    try {
      console.log("📄 Generating PDF...");
      const pdfBuffer = await generateInvoicePDF(
        { 
          invoiceId: invoiceId, 
          amount: selectedPlan.price,
          duration: `${selectedPlan.duration} ${selectedPlan.unit}`,
          checkInDate: residentDetails.checkInDate
        },
        { 
          fullName: residentDetails.fullName,
          email: residentDetails.email,
          mobileNumber: residentDetails.mobileNumber,
          address: { 
              street: residentDetails.street,
              city: residentDetails.city,
              state: residentDetails.state,
              pincode: residentDetails.pincode
          }
        },
        { roomNumber: room.roomNumber, type: room.type, capacity: room.capacity }
      );

      console.log("📧 Sending Email...");
      await sendBookingConfirmation(residentDetails.email, residentDetails.fullName, pdfBuffer);
    } catch (emailErr) {
      console.error("⚠️ Invoice Email Failed (Booking still valid):", emailErr.message);
      // We don't throw here because the booking was successful
    }

    res.json({ 
      message: 'Booking Successful', 
      bookingId: newBooking._id 
    });

  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ message: 'Booking failed: ' + error.message });
  }
});
router.post('/checkout', authMiddleware, async (req, res) => {
  const { roomId, planId } = req.body;

  try {
    // Fetch Room AND Populate the Discount
    const room = await Room.findById(roomId).populate('activeDiscount');
    
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.isOccupied) return res.status(400).json({ message: 'Room is full' });

    const selectedPlan = room.pricingPlans.id(planId);
    if (!selectedPlan) return res.status(400).json({ message: 'Invalid Plan' });

    // --- CALCULATE DISCOUNTED PRICE ---
    let finalPrice = selectedPlan.price;
    
    if (room.activeDiscount) {
      const { type, value } = room.activeDiscount;
      if (type === 'Fixed') {
        finalPrice = Math.max(0, finalPrice - value);
      } else if (type === 'Percentage') {
        finalPrice = finalPrice - (finalPrice * (value / 100));
      }
    }
    // ----------------------------------

    const options = {
      amount: Math.round(finalPrice * 100), // Use Final Price
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
    console.error(error);
    res.status(500).json({ message: 'Payment Init Failed' });
  }
});

// --- 3. SERVICE CHECKOUT: CREATE ORDER ---
router.post('/service/checkout', authMiddleware, async (req, res) => {
  const { serviceId } = req.body;

  try {
    const service = await Service.findById(serviceId);
    
    if (!service) return res.status(404).json({ message: 'Service not found' });

    const options = {
      amount: Math.round(service.price * 100), // Convert to paise
      currency: 'INR',
      receipt: `svc_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      orderId: order.id,
      amount: options.amount,
      currency: options.currency,
      service: service 
    });

  } catch (error) {
    console.error("Service Checkout Error:", error);
    res.status(500).json({ message: 'Service Payment Init Failed: ' + error.message });
  }
});

// --- 4. SERVICE VERIFY: VERIFY & CREATE INVOICE ---
router.post('/service/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, serviceId, studentData } = req.body;

  try {
    // 1. Verify Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', KEY_SECRET).update(body.toString()).digest('hex');
    
    if (expectedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid Signature' });

    const service = await Service.findById(serviceId);
    
    // 2. Calculate validity period
    let validUntilDate = null;
    let validUntilFormatted = null;
    if (service.period === 'Monthly') {
      validUntilDate = new Date();
      validUntilDate.setMonth(validUntilDate.getMonth() + 1);
      validUntilFormatted = validUntilDate.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
    
    // 3. Create Invoice (Paid)
    const invoiceId = `SVC-${Date.now()}`;
    const newInvoice = await Invoice.create({
      student: req.user.userId,
      invoiceId: invoiceId,
      items: [{ description: `Service: ${service.name} (${service.period})`, amount: service.price }],
      totalAmount: service.price,
      status: 'Paid',
      paidAt: new Date()
    });

    // 4. Create StudentService record to track purchase
    const studentService = await StudentService.create({
      student: req.user.userId,
      service: serviceId,
      invoice: newInvoice._id,
      validFrom: new Date(),
      validUntil: validUntilDate,
      credentials: service.credentials, // Copy credentials from service
      status: 'Active'
    });

    // 5. Create in-app notification
    await Notification.create({
      user: req.user.userId,
      type: 'Service',
      message: `Your service "${service.name}" has been activated successfully!${validUntilFormatted ? ' Valid until ' + validUntilFormatted : ''}`
    });

    // 6. Generate Invoice PDF
    console.log("📄 Generating Service Invoice...");
    const pdfBuffer = await generateInvoicePDF(
      { 
        invoiceId, 
        amount: service.price, 
        date: new Date(),
        description: service.name
      },
      studentData,
      null
    );

    await sendBookingConfirmation(studentData.email, studentData.username, pdfBuffer);

    // 7. Handle Mess Pass Generation
    let messPassPDF = null;
    if (service.serviceType === 'Mess') {
      console.log("📋 Generating Mess Pass...");
      
      // Get student's room number from booking
      const booking = await Booking.findOne({ 
        student: req.user.userId, 
        status: { $in: ['Active', 'active', 'Pending', 'CheckedIn', 'Paid'] } 
      }).populate('room', 'roomNumber');

      messPassPDF = await generateMessPassPDF(
        {
          fullName: studentData.username,
          email: studentData.email,
          roomNumber: booking?.room?.roomNumber || 'Not Assigned'
        },
        {
          passNumber: studentService.passNumber,
          validFrom: new Date().toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          validUntil: validUntilFormatted || 'N/A',
          amount: service.price
        }
      );
    }

    // 8. Send service activation email with credentials and/or mess pass
    await sendServicePurchaseEmail(
      studentData.email, 
      studentData.username, 
      {
        serviceName: service.name,
        price: service.price,
        period: service.period,
        validUntil: validUntilFormatted,
        invoiceId: invoiceId,
        credentials: service.credentials,
        serviceType: service.serviceType
      },
      messPassPDF,
      messPassPDF ? `Mess_Pass_${studentService.passNumber}.pdf` : null
    );

    res.json({ 
      message: 'Service Activated & Invoice Sent',
      studentServiceId: studentService._id,
      passNumber: service.serviceType === 'Mess' ? studentService.passNumber : null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Payment verified but invoice generation failed' });
  }
});

// --- 5. INVOICE CHECKOUT: CREATE ORDER (For Fines/Dues) ---
router.post('/invoice/checkout', authMiddleware, async (req, res) => {
  const { invoiceId } = req.body;
  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Paid') return res.status(400).json({ message: 'Already Paid' });

    const options = {
      amount: Math.round(invoice.totalAmount * 100),
      currency: 'INR',
      receipt: `inv_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ orderId: order.id, amount: options.amount, currency: options.currency, invoice });
  } catch (err) {
    res.status(500).json({ message: 'Order creation failed' });
  }
});

// --- 6. INVOICE VERIFY: VERIFY & UPDATE ---
router.post('/invoice/verify', authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId, studentData } = req.body;

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', KEY_SECRET).update(body.toString()).digest('hex');
    
    if (expectedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid Signature' });

    // 1. Update Invoice to PAID
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId, 
      { status: 'Paid', paidAt: new Date() },
      { new: true }
    );

    // 2. Create in-app notification for payment confirmation
    const itemDesc = invoice.items.map(i => i.description).join(', ');
    await Notification.create({
      user: req.user.userId,
      type: 'Payment',
      message: `Payment of ₹${invoice.totalAmount} received for: ${itemDesc}`
    });

    // 3. Generate Receipt & Email
    console.log("📄 Generating Receipt...");
    const pdfBuffer = await generateInvoicePDF(
      { 
        invoiceId: invoice.invoiceId, 
        amount: invoice.totalAmount, 
        date: new Date(),
        description: itemDesc // "Fine: Broken Window"
      },
      studentData, 
      null // No Room Data
    );

    await sendBookingConfirmation(studentData.email, studentData.username, pdfBuffer);

    // 4. Send payment confirmation email
    await sendFinePaymentConfirmationEmail(studentData.email, studentData.username, {
      description: itemDesc,
      amount: invoice.totalAmount,
      invoiceId: invoice.invoiceId,
      paidAt: new Date().toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    res.json({ message: 'Payment Successful' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Payment verified but update failed' });
  }
});

// --- 7. DOWNLOAD INVOICE PDF ---
router.get('/invoice/:id', authMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('student') // Get User details
      .populate({
        path: 'booking',
        populate: { path: 'room' } // Get Room details if applicable
      });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Security Check: Only the owner or Admin can download
    if (req.user.role !== 'admin' && invoice.student._id.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch Profile for Address/Phone details
    const profile = await Profile.findOne({ user: invoice.student._id });

    // Prepare Data for Generator
    const studentData = {
        fullName: invoice.student.username,
        email: invoice.student.email,
        mobileNumber: profile?.phoneNumber || '',
        address: profile?.address || {}
    };

    const roomData = invoice.booking ? {
        roomNumber: invoice.booking.room.roomNumber,
        type: invoice.booking.room.type,
        capacity: invoice.booking.room.capacity
    } : null;

    // Generate PDF Buffer
    const pdfBuffer = await generateInvoicePDF(
      {
        invoiceId: invoice.invoiceId,
        amount: invoice.totalAmount,
        date: invoice.createdAt, // Use original creation date
        description: invoice.items.map(i => i.description).join(', '),
        checkInDate: invoice.booking?.checkInDate,
        duration: invoice.booking?.duration
      },
      studentData,
      roomData
    );

    // Send File
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Invoice-${invoice.invoiceId}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error("Download Error:", err);
    res.status(500).json({ message: 'Error generating invoice file' });
  }
});

export default router;