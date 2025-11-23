import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import Profile from '../models/Profile.model.js';
import Booking from '../models/Booking.model.js';

const router = express.Router();

// --- GET MY PROFILE ---
// @route   GET /api/profile/me
// @desc    Get the logged-in user's profile
// @access  Private (for all users)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // We get req.user.userId from the authMiddleware
    const profile = await Profile.findOne({ user: req.user.userId })
                                 .populate('user', ['username', 'email', 'role', 'photoUrl']); // Attach user info

    if (!profile) {
      // If a student has no profile yet, return empty profile structure
      return res.status(200).json({ 
        message: 'Profile not yet created.',
        fullName: null,
        dateOfBirth: null,
        age: null,
        gender: null,
        phoneNumber: null,
        altPhone: null,
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: ''
        }
      });
    }
    
    res.status(200).json(profile);

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// --- SYNC PROFILE FROM BOOKING DATA ---
// @route   POST /api/profile/sync-from-booking
// @desc    Sync profile data from existing booking (for users who booked before profile update)
// @access  Private
router.post('/sync-from-booking', authMiddleware, async (req, res) => {
  try {
    // Find the user's most recent booking
    const booking = await Booking.findOne({ student: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!booking || !booking.residentDetails) {
      return res.status(404).json({ message: 'No booking found with resident details.' });
    }

    const residentDetails = booking.residentDetails;

    // Calculate age from DOB if available
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

    // Update or create profile with booking data
    const profileData = {
      fullName: residentDetails.fullName,
      dateOfBirth: residentDetails.dob,
      age: calculatedAge,
      gender: residentDetails.gender,
      phoneNumber: residentDetails.mobileNumber,
      altPhone: residentDetails.altPhone
    };

    // Parse address if it exists
    if (residentDetails.address) {
      const addressParts = residentDetails.address.split(',').map(part => part.trim());
      if (addressParts.length >= 4) {
        profileData.address = {
          street: addressParts[0] || '',
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          zipCode: addressParts[3] || ''
        };
      }
    }

    const profile = await Profile.findOneAndUpdate(
      { user: req.user.userId },
      { $set: profileData },
      { upsert: true, new: true }
    ).populate('user', ['username', 'email', 'role', 'photoUrl']);

    res.status(200).json({ 
      message: 'Profile synced successfully from booking data.',
      profile 
    });

  } catch (error) {
    console.error('Error syncing profile from booking:', error);
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