const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: Date, default: Date.now },
  description: { type: String },
  paymentMethod: { type: String, default: '' }
});
expenseSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
