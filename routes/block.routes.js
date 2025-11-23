import express from 'express';
import Block from '../models/Block.model.js';
import Room from '../models/Room.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// --- 1. GET ALL BLOCKS ---
router.get('/', authMiddleware, async (req, res) => {
  try {
    const blocks = await Block.find().sort({ name: 1 });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching blocks' });
  }
});

// --- 2. CREATE BLOCK ---
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  
  try {
    const newBlock = new Block(req.body);
    await newBlock.save();
    res.status(201).json(newBlock);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Block already exists' });
    }
    res.status(500).json({ message: 'Server error creating block' });
  }
});

// --- 3. DELETE BLOCK (And all its rooms!) ---
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

  try {
    const block = await Block.findById(req.params.id);
    if (!block) return res.status(404).json({ message: 'Block not found' });

    // 1. Delete all rooms in this block first (Cleanup)
    await Room.deleteMany({ block: block.name });

    // 2. Delete the block itself
    await block.deleteOne();

    res.json({ message: `Block ${block.name} and all its rooms were deleted.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting block' });
  }
});

export default router;