const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const upload = require('../middleware/upload');

const passport = require('passport');


// Google Sign-In / Sign-Up
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });

    // Auto-register if not existing
    if (!user) {
      user = await User.create({
        name,
        email,
        password: 'google-oauth', // placeholder
        status: 'active'
      });
    }

    const jwtToken = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
        engineerTickets: user.engineerTickets
      }
    });
  } catch (err) {
    console.error('Google Auth error:', err);
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
});


// GitHub OAuth: redirect to GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

// GitHub OAuth callback
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    const token = req.user.getSignedJwtToken();
    // Redirect to frontend with token
    res.redirect(`http://localhost:3000/github-success?token=${token}`);
  }
);




// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password
    });
    
    // Generate token
    const token = user.getSignedJwtToken();
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
        engineerTickets: user.engineerTickets
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Login user - TEMPORARY TEST VERSION
router.post('/login-test', async (req, res) => {
  try {
    // For testing only
    const user = await User.findOne().select('+password');
    if (!user) {
      return res.status(zz401).json({ success: false, message: 'No users in database' });
    }
    
    // Generate token
    const token = user.getSignedJwtToken();
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login test error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }
    
    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is not active' });
    }
    
    // Generate token
    const token = user.getSignedJwtToken();
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
        engineerTickets: user.engineerTickets
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
        engineerTickets: user.engineerTickets,
        avatar: user.avatar, // Add this line
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Upload avatar - moved outside the /me route
router.post('/upload-avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    // Create the avatar URL
    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    
    // Update user's avatar in database
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aiCredits: user.aiCredits,
        engineerTickets: user.engineerTickets,
        avatar: user.avatar,
        bio: user.bio,
        company: user.company,
        location: user.location,
        website: user.website,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Add this route after the /me route
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, bio, company, location, website, avatar } = req.body;
    
    // Update user profile
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, bio, company, location, website, avatar },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;