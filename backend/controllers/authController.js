const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sanitizeString, validateEmail } = require('../utils/helpers');
const { JWT_SECRET } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

// POST /api/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  const sanitizedName = sanitizeString(name, 100);
  const sanitizedEmail = sanitizeString(email, 254).toLowerCase();
  if (!sanitizedName || sanitizedName.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
  if (!validateEmail(sanitizedEmail)) return res.status(400).json({ error: 'Invalid email format' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password.length > 128) return res.status(400).json({ error: 'Password is too long' });
  try {
    const hashed = await bcrypt.hash(password, 12);
    const user = new User({ name: sanitizedName, email: sanitizedEmail, password: hashed });
    await user.save();
    res.status(201).json({ userId: user._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'An account with this email already exists' });
    console.error('[REGISTER] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields are required' });
  const sanitizedEmail = sanitizeString(email, 254).toLowerCase();
  try {
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    user.lastLoginAt = new Date();
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
    res.json({
      token,
      user: {
        name: user.name, email: user.email, profilePicture: user.profilePicture || '',
        currency: user.currency || 'INR', createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt, passwordChangedAt: user.passwordChangedAt,
      }
    });
  } catch (err) {
    console.error('[LOGIN] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/health
const health = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

module.exports = { register, login, health };
