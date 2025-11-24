import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();
const saltRounds = 10;

// --- SIGNUP ROUTE ---
// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  // 1. Basic Validation
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  // 2. Password length validation
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters long." });
  }

  try {
    // 3. Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Username or email already in use." });
    }

    // 4. Hash the password
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Create the new user
    const newUser = await User.create({
      username,
      email,
      passwordHash,
      // The 'role' will be set to 'student' by default (from the model)
    });

    // 6. Send a success response
    res.status(201).json({
      message: "User created successfully!",
      userId: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Server error during signup." });
  }
});

// --- LOGIN ROUTE ---
// @route   POST /api/auth/login
// @desc    Authenticate a user and return a token
// @access  Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic Validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password." });
  }

  try {
    // 2. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Use a generic message for security
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3. Check if password is correct
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Use the same generic message
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 4. If credentials are correct, create a JWT
    const payload = {
      userId: user._id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "3d" } // Token expires in 3 days
    );

    // 5. Check if student has a booking (for redirect logic)
    let hasBooking = false;
    if (user.role === 'student') {
      const Booking = (await import('../models/Booking.model.js')).default;
      const booking = await Booking.findOne({ student: user._id, status: 'Active' });
      hasBooking = !!booking;
    }

    // 6. Send the token and user info back to the client
    // (Don't send the password hash!)
    res.status(200).json({
      message: "Login successful!",
      token: token,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        designation: user.designation,
        isFirstLogin: user.isFirstLogin,
        photoUrl: user.photoUrl,
      },
      hasBooking,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // 1. Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 2. Update User: Set new password AND turn off isFirstLogin
    await User.findByIdAndUpdate(req.user.userId, {
      passwordHash: passwordHash,
      isFirstLogin: false 
    });

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- GET CURRENT USER ---
// @route   GET /api/auth/me
// @desc    Get current user information
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        gender: user.gender,
        designation: user.designation,
        phoneNumber: user.phoneNumber,
        age: user.age,
        address: user.address,
        photoUrl: user.photoUrl,
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- UPDATE USER PROFILE ---
// @route   PUT /api/auth/update-profile
// @desc    Update user profile information (editable fields only)
// @access  Private
router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, age, address } = req.body;

    // Validate phoneNumber
    if (phoneNumber && !/^[0-9]{10}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Phone number must be 10 digits' });
    }

    // Validate age
    if (age && (age < 18 || age > 100)) {
      return res.status(400).json({ message: 'Age must be between 18 and 100' });
    }

    // Validate address
    if (address && address.length < 10) {
      return res.status(400).json({ message: 'Address must be at least 10 characters' });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { phoneNumber, age, address },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        userId: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        gender: updatedUser.gender,
        designation: updatedUser.designation,
        phoneNumber: updatedUser.phoneNumber,
        age: updatedUser.age,
        address: updatedUser.address,
        photoUrl: updatedUser.photoUrl,
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- FORGOT PASSWORD ---
// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please provide your email address' });
  }

  try {
    console.log('Password reset requested for email:', email);
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // User doesn't exist - return error message
      console.log('❌ User not found in database - NO EMAIL SENT');
      return res.status(404).json({ 
        message: 'This email is not registered. Please sign up first.',
        notRegistered: true 
      });
    }

    console.log('✓ User found:', user.username, '| Role:', user.role);

    // Only allow students and staff to reset password
    if (user.role !== 'student' && user.role !== 'staff') {
      // For admins/wardens, deny access
      console.log('❌ User is admin/warden - NO EMAIL SENT');
      return res.status(403).json({ 
        message: 'Password reset is only available for students and staff. Please contact administration.' 
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save token and expiry to database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email only if user exists and is student/staff
    console.log('📧 Sending password reset email to:', user.email);
    const { sendPasswordResetEmail } = await import('../utils/email.js');
    await sendPasswordResetEmail(user.email, user.username, resetToken);
    console.log('✅ Password reset email sent successfully');

    res.json({ message: 'Password reset link has been sent to your email.' });
  } catch (error) {
    console.error('❌ Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// --- RESET PASSWORD ---
// @route   POST /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    // Find user and check token validity
    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset fields
    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isFirstLogin = false; // Also mark as not first login
    await user.save();

    // Send confirmation email
    const { sendPasswordChangedConfirmationEmail } = await import('../utils/email.js');
    await sendPasswordChangedConfirmationEmail(user.email, user.username);

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

export default router;
