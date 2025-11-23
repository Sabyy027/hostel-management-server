import express from "express";
import Invoice from "../models/Invoice.model.js";
import User from "../models/User.model.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { sendDueReminder, sendFineNotificationEmail } from "../utils/email.js";
import Notification from "../models/Notification.model.js";

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin only" });
  next();
};

// --- 1. ADD FINE / SERVICE CHARGE ---
router.post("/create-charge", [authMiddleware, adminOnly], async (req, res) => {
  const { studentId, type, description, amount, dueDate } = req.body;
  // type: 'Fine', 'Service', 'Utility'

  try {
    const invoiceId = `${type.toUpperCase().slice(0, 3)}-${Date.now()}`;

    const newInvoice = new Invoice({
      student: studentId,
      invoiceId: invoiceId,
      // We use the existing 'items' array structure
      items: [{ description, amount }],
      totalAmount: amount,
      status: "Pending",
      dueDate: dueDate || new Date(), // Default to Due Now
    });

    await newInvoice.save();

    // Create in-app notification for the student
    await Notification.create({
      user: studentId,
      type: type === 'Fine' ? 'Fine' : 'Payment',
      message: `New ${type.toLowerCase()} of ₹${amount} has been added: ${description}`
    });

    // Send email notification to student (for fines)
    if (type === 'Fine') {
      const student = await User.findById(studentId);
      if (student && student.email) {
        const formattedDueDate = dueDate 
          ? new Date(dueDate).toLocaleDateString('en-IN', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : 'Immediate';

        await sendFineNotificationEmail(student.email, student.username, {
          description: description,
          amount: amount,
          dueDate: formattedDueDate,
          invoiceId: invoiceId
        });
      }
    }

    res
      .status(201)
      .json({ message: `${type} added successfully`, invoice: newInvoice });
  } catch (error) {
    console.error('Error creating charge:', error);
    res.status(500).json({ message: "Error creating charge" });
  }
});

// --- 2. APPLY DISCOUNT (Credit Note) ---
// This creates a "Negative" invoice or marks an existing one as discounted
router.post(
  "/apply-discount",
  [authMiddleware, adminOnly],
  async (req, res) => {
    const { studentId, description, amount } = req.body;

    try {
      // Strategy: Create a "Credit" invoice with negative amount?
      // Or simpler: Just record it as a "Paid" adjustment for tracking.
      // Let's create a special "Discount" record.

      const invoiceId = `DSC-${Date.now()}`;

      const discountInvoice = new Invoice({
        student: studentId,
        invoiceId: invoiceId,
        items: [{ description: `DISCOUNT: ${description}`, amount: -amount }],
        totalAmount: -amount,
        status: "Paid", // Discounts are auto-"paid"
        paidAt: new Date(),
      });

      await discountInvoice.save();
      res.status(201).json({ message: "Discount applied successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error applying discount" });
    }
  }
);

// --- 3. GET RESIDENT FINANCIAL HISTORY ---
router.get(
  "/history/:studentId",
  [authMiddleware, adminOnly],
  async (req, res) => {
    try {
      const invoices = await Invoice.find({
        student: req.params.studentId,
      }).sort({ createdAt: -1 });
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Error fetching history" });
    }
  }
);
router.post("/send-reminder", [authMiddleware, adminOnly], async (req, res) => {
  const { studentId, email, name, amount } = req.body;
  try {
    await sendDueReminder(email, name, amount);
    res.json({ message: "Reminder Sent" });
  } catch (error) {
    res.status(500).json({ message: "Error sending reminder" });
  }
});

// --- STUDENT: GET MY PENDING DUES ---
router.get('/my-pending', authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({ 
      student: req.user.userId, 
      status: 'Pending' 
    }).sort({ createdAt: -1 });
    
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dues' });
  }
});

// --- ADMIN: GET ALL INVOICES ---
router.get('/all-invoices', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('student', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices' });
  }
});

export default router;
