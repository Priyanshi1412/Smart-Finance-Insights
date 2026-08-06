const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { Feedback } = require('../models');
const auth = require('../middleware/auth');

router.post('/', auth, asyncHandler(async (req, res) => {
  const { category, rating, message, email } = req.body;

  if (!category || !rating || !message) {
    return res.status(400).json({ error: 'Category, rating, and message are required' });
  }

  const validCategories = ['General Feedback', 'Feature Request', 'Bug Report', 'UI/UX Suggestion', 'Performance Issue', 'Other'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }

  if (typeof message !== 'string' || message.trim().length < 3) {
    return res.status(400).json({ error: 'Message must be at least 3 characters' });
  }

  const sanitizedMessage = message.trim().slice(0, 2000);
  const sanitizedEmail = email ? String(email).trim().slice(0, 254) : '';

  const feedback = new Feedback({
    userId: req.userId,
    category,
    rating: ratingNum,
    message: sanitizedMessage,
    email: sanitizedEmail,
  });

  await feedback.save();

  res.status(201).json({ message: 'Feedback submitted successfully', id: feedback._id });
}));

module.exports = router;
