const bcrypt = require('bcrypt');
const { User, Income, Expense, Budget, Goal, Investment, Notification } = require('../models');
const { sanitizeString, validateEmail } = require('../utils/helpers');
const { VALID_CURRENCIES } = require('../config/constants');
const asyncHandler = require('../middleware/asyncHandler');

const getAccountInfo = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ name: user.name, email: user.email, profilePicture: user.profilePicture || '', currency: user.currency || 'INR', createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, passwordChangedAt: user.passwordChangedAt });
  } catch (err) {
    console.error('[ACCOUNT INFO] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const updateProfile = asyncHandler(async (req, res) => {
  try {
    const { name, profilePicture } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (name !== undefined) { const sanitizedName = sanitizeString(name, 100); if (!sanitizedName || sanitizedName.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' }); user.name = sanitizedName; }
    if (profilePicture !== undefined) {
      if (profilePicture && !profilePicture.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image format' });
      if (profilePicture && profilePicture.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image size must be less than 5MB' });
      user.profilePicture = profilePicture;
    }
    await user.save();
    res.json({ name: user.name, email: user.email, profilePicture: user.profilePicture || '', currency: user.currency || 'INR' });
  } catch (err) {
    console.error('[UPDATE PROFILE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const removeProfilePicture = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.profilePicture = '';
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[REMOVE PROFILE PICTURE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const changePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[CHANGE PASSWORD] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const updateCurrency = asyncHandler(async (req, res) => {
  try {
    const { currency } = req.body;
    if (!VALID_CURRENCIES.includes(currency)) return res.status(400).json({ error: 'Invalid currency' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.currency = currency;
    await user.save();
    res.json({ success: true, currency: user.currency });
  } catch (err) {
    console.error('[UPDATE CURRENCY] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const clearData = asyncHandler(async (req, res) => {
  try {
    const results = await Promise.all([
      Income.deleteMany({ userId: req.userId }), Expense.deleteMany({ userId: req.userId }),
      Budget.deleteMany({ userId: req.userId }), Goal.deleteMany({ userId: req.userId }),
      Investment.deleteMany({ userId: req.userId }), Notification.deleteMany({ userId: req.userId }),
    ]);
    const total = results.reduce((s, r) => s + r.deletedCount, 0);
    res.json({ success: true, deletedCount: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getAccountInfo, updateProfile, removeProfilePicture, changePassword, updateCurrency, clearData };
