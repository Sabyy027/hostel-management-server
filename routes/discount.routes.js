import express from 'express';
import Discount from '../models/Discount.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

// GET ALL DISCOUNTS
router.get('/', authMiddleware, async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json(discounts);
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

// CREATE DISCOUNT
router.post('/', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const newDiscount = new Discount(req.body);
    await newDiscount.save();
    res.status(201).json(newDiscount);
  } catch (err) { res.status(500).json({ message: 'Error creating discount' }); }
});

// DELETE DISCOUNT
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    await Discount.findByIdAndDelete(req.params.id);
    res.json({ message: 'Discount deleted' });
  } catch (err) { res.status(500).json({ message: 'Error deleting discount' }); }
});

export default router;