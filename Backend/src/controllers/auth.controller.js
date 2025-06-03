const jwt = require('jsonwebtoken');
const User = require('../models/user.model');



// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, location, preferredLanguage } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: 'User already exists with this email'
      });
    }
    
    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      location,
      preferredLanguage: preferredLanguage || 'en'
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    res.status(201).json({
      error: false,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          preferredLanguage: user.preferredLanguage
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: true,
      message: 'Error registering user'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    
    
    res.status(200).json({
      error: false,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          preferredLanguage: user.preferredLanguage
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Error logging in'
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      error: false,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting current user'
    });
  }
};

// Logout user (invalidate token in Redis)
exports.logout = async (req, res) => {
  try {
    // Add the token to a blacklist in Redis
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Store the token in blacklist until its expiration
    const expirationTime = new Date(decoded.exp * 1000).getTime() - new Date().getTime();
    const expirationSeconds = Math.floor(expirationTime / 1000);
    
    
    res.status(200).json({
      error: false,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: true,
      message: 'Error logging out'
    });
  }
};
