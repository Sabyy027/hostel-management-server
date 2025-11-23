import express from 'express';
import Notification from '../models/Notification.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(20);
    const unreadCount = await Notification.countDocuments({ user: req.user.userId, read: false });
    res.json({ notifications, unreadCount });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ message: 'Marked read' });
});

export default router;