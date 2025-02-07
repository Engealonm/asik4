const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const multer = require('multer');

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; 

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve login page
router.get('/login', (req, res) => {
  res.render('login', { message: null });
});

// Serve register page
router.get('/register', (req, res) => {
  res.render('register');
});

// Serve dashboard page
router.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  res.render('dashboard', { user });
});


router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const user = new User({ username, email, password });
    await user.save();
    res.redirect('/login');
  } catch (error) {
    res.render('error', { message: 'Registration Error: ' + error.message });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.render('error', { message: 'Invalid credentials' });

    if (user.isLocked()) {
      return res.render('error', { message: 'Account is locked. Try again later.' });
    }

    if (await bcrypt.compare(password, user.password)) {
      user.failedAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
      req.session.userId = user._id;
      res.redirect('/dashboard');
    } else {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = Date.now() + LOCK_TIME;
      }
      await user.save();
      res.render('error', { message: 'Invalid credentials' });
    }
  } catch (error) {
    res.render('error', { message: 'Login Error: ' + error.message });
  }
});


router.get('/profile', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = await User.findById(req.session.userId);
  res.render('profile', { user, message: null });
});


router.post('/profile', upload.single('profilePicture'), async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const user = await User.findById(req.session.userId);
    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = password;
    if (req.file) user.profilePicture = '/uploads/' + req.file.filename;
    await user.save();
    res.render('profile', { user, message: 'Profile updated successfully!' });
  } catch (error) {
    res.render('error', { message: 'Profile Update Error: ' + error.message });
  }
});

router.post('/profile/delete', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.session.userId);
    req.session.destroy(() => res.redirect('/register'));
  } catch (error) {
    res.render('error', { message: 'Error deleting account: ' + error.message });
  }
});


router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
