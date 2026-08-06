const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: String,
    required: true,
    enum: ['General Feedback', 'Feature Request', 'Bug Report', 'UI/UX Suggestion', 'Performance Issue', 'Other'],
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  message: { type: String, required: true, maxlength: 2000 },
  email: { type: String, default: '', maxlength: 254 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
