import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; 
import User from '../models/User.model.js';

const router = express.Router();
const saltRounds = 10;

// --- SIGNUP ROUTE ---
// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  
  // 1. Basic Validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    // 2. Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Username or email already in use.' });
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create the new user
    const newUser = await User.create({
      username,
      email,
      passwordHash,
      // The 'role' will be set to 'student' by default (from the model)
    });

    // 5. Send a success response
    res.status(201).json({
      message: 'User created successfully!',
      userId: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role, 
    });

  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Server error during signup.' });
  }
});


// --- LOGIN ROUTE ---
// @route   POST /api/auth/login
// @desc    Authenticate a user and return a token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic Validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    // 2. Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Use a generic message for security
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 3. Check if password is correct
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Use the same generic message
      return res.status(401).json({ message: 'Invalid credentials.' });
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
      { expiresIn: '3d' } // Token expires in 3 days
    );

    // 5. Send the token and user info back to the client
    // (Don't send the password hash!)
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

export default router;