import express from 'express';
import Expense from '../models/Expense.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

// GET ALL EXPENSES (Sorted by date)
router.get('/', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// ADD EXPENSE
router.post('/', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const newExpense = new Expense(req.body);
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (err) { res.status(500).json({ message: 'Error saving expense' }); }
});

// DELETE EXPENSE
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;