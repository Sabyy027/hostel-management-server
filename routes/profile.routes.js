import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import Profile from '../models/Profile.model.js';

const router = express.Router();

// --- GET MY PROFILE ---
// @route   GET /api/profile/me
// @desc    Get the logged-in user's profile
// @access  Private (for all users)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // We get req.user.userId from the authMiddleware
    const profile = await Profile.findOne({ user: req.user.userId })
                                 .populate('user', ['username', 'email', 'role']); // Attach user info

    if (!profile) {
      // If a student has no profile yet, this is not an error
      // We just return an empty object or a specific message
      return res.status(200).json({ message: 'Profile not yet created.' });
    }
    
    res.status(200).json(profile);

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// --- CREATE OR UPDATE MY PROFILE ---
// @route   POST /api/profile
// @desc    Create or update the logged-in user's profile
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  const { 
    studentId, 
    phoneNumber, 
    address, // This will be an object: { street, city, ... }
    emergencyContact // This will also be an object
  } = req.body;

  // Build the profile fields
  const profileFields = {
    user: req.user.userId,
    studentId,
    phoneNumber,
    address,
    emergencyContact,
  };

  try {
    // Using findOneAndUpdate with 'upsert: true'
    // This will UPDATE the profile if it exists,
    // or CREATE it if it doesn't.
    
    const options = {
      new: true,         // Return the new, updated document
      upsert: true,      // Create a new one if it doesn't exist
      runValidators: true, // Run schema validation
    };

    const profile = await Profile.findOneAndUpdate(
      { user: req.user.userId }, // Find by user ID
      { $set: profileFields },   // Set the new data
      options
    );

    res.status(200).json(profile);

  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

export default router;