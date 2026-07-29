const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  currentValue: { type: Number, default: 0 },
  investedDate: { type: Date, default: Date.now },
  expectedReturns: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
investmentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Investment', investmentSchema);
