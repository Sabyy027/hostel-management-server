import express from 'express';
import User from '../models/User.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth.middleware.js';
import { sendStaffCredentials, sendRegistrationAcknowledgement } from '../utils/email.js';
import upload from '../middleware/upload.middleware.js';
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from '../utils/cloudinaryUpload.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  next();
};

// --- 1. GET ALL STAFF (Fixed to include Wardens) ---
router.get('/staff', authMiddleware, async (req, res) => {
  try {
    // Fetch staff, warden, and rt roles
    const staff = await User.find({ 
      role: { $in: ['staff', 'warden', 'rt'] } 
    }).select('-passwordHash').populate('assignedFloors', 'name number');
    
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- METHOD 1: ADMIN DIRECT CREATE (Auto-Email) ---
router.post('/create-staff-direct', [authMiddleware, adminOnly], async (req, res) => {
  const { username, email, age, gender, phoneNumber, altPhoneNumber, address, designation } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // 1. Generate Random Password (8 characters)
    const randomPassword = Math.random().toString(36).slice(-8);
    
    // 2. Hash It
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(randomPassword, salt);

    // --- Set appropriate role based on designation ---
    let role = 'staff';
    if (designation === 'Warden') {
      role = 'warden';
    } else if (designation === 'Resident Tutor') {
      role = 'rt';
    }
    // ------------------------------------------------

    // 3. Create User
    const newStaff = new User({
      username, 
      email, 
      passwordHash, 
      role, // <--- Use the dynamic role variable
      age,
      gender,
      phoneNumber, 
      altPhoneNumber, 
      address, 
      designation,
      isFirstLogin: true
    });
    await newStaff.save();

    // 4. Send Email
    await sendStaffCredentials(email, username, randomPassword);

    res.status(201).json({ message: `Created ${designation} with role '${role}'` });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// --- METHOD 2A: GENERATE INVITE LINK ---
router.post('/generate-invite', [authMiddleware, adminOnly], async (req, res) => {
  try {
    // Create a token valid for 24 hours
    const inviteToken = jwt.sign(
      { type: 'staff_invite', issuedBy: req.user.userId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Construct the frontend link using environment variable
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendURL}/staff-register?token=${inviteToken}`;
    
    res.json({ link });
  } catch (error) {
    res.status(500).json({ message: 'Error generating link' });
  }
});

// --- METHOD 2B: STAFF SELF-REGISTER (Via Link) ---
router.post('/staff-signup-via-link', async (req, res) => {
  const { token, username, email, password, age, gender, phoneNumber, address, designation } = req.body;

  try {
    // 1. Verify Token
    jwt.verify(token, process.env.JWT_SECRET);

    // 2. Check Email
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });

    // 3. Hash Password (Set by Staff)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // --- Set appropriate role based on designation ---
    let role = 'staff';
    if (designation === 'Warden') {
      role = 'warden';
    } else if (designation === 'Resident Tutor') {
      role = 'rt';
    }
    // ------------------------------------------------

    // 4. Create Staff
    const newStaff = new User({
      username, email, passwordHash, 
      role, // <--- Use dynamic role
      age, gender,
      phoneNumber, address, designation
    });
    await newStaff.save();

    // --- NEW: SEND ACKNOWLEDGEMENT EMAIL ---
    await sendRegistrationAcknowledgement(email, username);
    // ---------------------------------------

    res.status(201).json({ message: 'Registration successful! Please login.' });
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile picture from Cloudinary if exists
    if (user.photoUrl) {
      const oldPublicId = getPublicIdFromUrl(user.photoUrl);
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId).catch(err => 
          console.log('Error deleting old image:', err)
        );
      }
    }

    // Upload new image to Cloudinary
    const result = await uploadToCloudinary(
      req.file.buffer,
      'profiles',
      `user_${user._id}`
    );

    // Update user's photoUrl
    user.photoUrl = result.secure_url;
    await user.save();

    res.json({
      message: 'Profile picture uploaded successfully',
      photoUrl: result.secure_url
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading profile picture', error: error.message });
  }
});

// --- DELETE PROFILE PICTURE ---
router.delete('/delete-profile-picture', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.photoUrl) {
      return res.status(400).json({ message: 'No profile picture to delete' });
    }

    // Delete from Cloudinary
    const publicId = getPublicIdFromUrl(user.photoUrl);
    if (publicId) {
      await deleteFromCloudinary(publicId).catch(err => 
        console.log('Error deleting image:', err)
      );
    }

    // Remove from user document
    user.photoUrl = null;
    await user.save();

    res.json({ message: 'Profile picture deleted successfully' });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting profile picture', error: error.message });
  }
});

// --- DELETE/REMOVE STAFF ---
router.delete('/staff/:staffId', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const { staffId } = req.params;
    
    // Find the staff member
    const staff = await User.findById(staffId);
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Ensure only staff/warden can be deleted (prevent deleting admin or students)
    if (staff.role !== 'staff' && staff.role !== 'warden') {
      return res.status(403).json({ message: 'Can only remove staff or warden accounts' });
    }

    // Delete profile picture from Cloudinary if exists
    if (staff.photoUrl) {
      const publicId = getPublicIdFromUrl(staff.photoUrl);
      if (publicId) {
        await deleteFromCloudinary(publicId).catch(err => 
          console.log('Error deleting staff profile image:', err)
        );
      }
    }

    // Delete the staff member
    await User.findByIdAndDelete(staffId);

    res.json({ 
      message: 'Staff member removed successfully',
      removedStaff: {
        name: staff.username,
        email: staff.email,
        designation: staff.designation
      }
    });

  } catch (error) {
    console.error('Error removing staff:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;