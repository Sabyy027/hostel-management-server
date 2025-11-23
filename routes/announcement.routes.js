import express from 'express';
import Announcement from '../models/Announcement.model.js';
import authMiddleware from '../middleware/auth.middleware.js';
import upload from '../middleware/multer.middleware.js';
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from '../utils/cloudinaryUpload.js';

const router = express.Router();

// Middleware to check if user can create announcements (Admin, Warden, RT)
const canCreateAnnouncement = (req, res, next) => {
  const allowedRoles = ['admin', 'warden'];
  const allowedDesignations = ['Resident Tutor'];
  
  if (allowedRoles.includes(req.user.role) || allowedDesignations.includes(req.user.designation)) {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied. Only admin, warden, and RTs can create announcements.' });
};

// --- GET ALL ACTIVE ANNOUNCEMENTS (For Everyone) ---
router.get('/', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    
    // Filter based on user role
    const filter = {
      isActive: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ]
    };

    // Filter by target audience
    if (req.user.role === 'student') {
      filter.$or = [
        { targetAudience: 'All' },
        { targetAudience: 'Students' }
      ];
    } else if (req.user.role === 'staff' || req.user.role === 'warden' || req.user.designation === 'Resident Tutor') {
      filter.$or = [
        { targetAudience: 'All' },
        { targetAudience: 'Staff' }
      ];
    }

    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'username role designation')
      .sort({ priority: -1, createdAt: -1 })
      .limit(50);

    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
});

// --- GET ALL ANNOUNCEMENTS (For Management - with filters) ---
router.get('/manage', [authMiddleware, canCreateAnnouncement], async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'username role designation')
      .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
});

// --- CREATE ANNOUNCEMENT (with optional image) ---
router.post('/', [authMiddleware, canCreateAnnouncement, upload.single('image')], async (req, res) => {
  try {
    const { title, content, priority, category, expiryDate, targetAudience } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    let imageUrl = null;

    // Upload image to Cloudinary if provided
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        'announcements'
      );
      imageUrl = result.secure_url;
    }

    const announcement = new Announcement({
      title,
      content,
      priority: priority || 'Medium',
      category: category || 'General',
      createdBy: req.user.userId,
      expiryDate: expiryDate || null,
      targetAudience: targetAudience || 'All',
      imageUrl
    });

    await announcement.save();
    
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'username role designation');

    res.status(201).json({ 
      message: 'Announcement created successfully', 
      announcement: populatedAnnouncement 
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ message: 'Error creating announcement' });
  }
});

// --- UPDATE ANNOUNCEMENT (with optional new image) ---
router.put('/:id', [authMiddleware, canCreateAnnouncement, upload.single('image')], async (req, res) => {
  try {
    const { title, content, priority, category, isActive, expiryDate, targetAudience, removeImage } = req.body;

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (announcement.imageUrl) {
        const oldPublicId = getPublicIdFromUrl(announcement.imageUrl);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId).catch(err => 
            console.log('Error deleting old image:', err)
          );
        }
      }

      // Upload new image
      const result = await uploadToCloudinary(req.file.buffer, 'announcements');
      announcement.imageUrl = result.secure_url;
    } else if (removeImage === 'true') {
      // Remove image if requested
      if (announcement.imageUrl) {
        const publicId = getPublicIdFromUrl(announcement.imageUrl);
        if (publicId) {
          await deleteFromCloudinary(publicId).catch(err => 
            console.log('Error deleting image:', err)
          );
        }
      }
      announcement.imageUrl = null;
    }

    // Update other fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (priority) announcement.priority = priority;
    if (category) announcement.category = category;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (expiryDate !== undefined) announcement.expiryDate = expiryDate;
    if (targetAudience) announcement.targetAudience = targetAudience;

    await announcement.save();

    const updatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'username role designation');

    res.json({ message: 'Announcement updated successfully', announcement: updatedAnnouncement });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ message: 'Error updating announcement' });
  }
});

// --- DELETE ANNOUNCEMENT (also delete image from Cloudinary) ---
router.delete('/:id', [authMiddleware, canCreateAnnouncement], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    // Delete image from Cloudinary if exists
    if (announcement.imageUrl) {
      const publicId = getPublicIdFromUrl(announcement.imageUrl);
      if (publicId) {
        await deleteFromCloudinary(publicId).catch(err => 
          console.log('Error deleting image:', err)
        );
      }
    }

    await announcement.deleteOne();

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ message: 'Error deleting announcement' });
  }
});

// --- TOGGLE ACTIVE STATUS ---
router.patch('/:id/toggle', [authMiddleware, canCreateAnnouncement], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();

    res.json({ message: 'Announcement status updated', announcement });
  } catch (error) {
    console.error('Error toggling announcement:', error);
    res.status(500).json({ message: 'Error updating announcement status' });
  }
});

export default router;
