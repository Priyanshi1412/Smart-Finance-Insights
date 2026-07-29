const { Expense } = require('../models');
const { sanitizeString, validateAmount } = require('../utils/helpers');
const asyncHandler = require('../middleware/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const { amount, category, date, description } = req.body;
  if (!amount || !category) return res.status(400).json({ error: 'Amount and category are required' });
  if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const expense = new Expense({
      userId: req.userId, amount: Number(amount), category: sanitizeString(category, 50),
      date: date ? new Date(date) : new Date(), description: sanitizeString(description || '', 500),
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    console.error('[EXPENSE POST] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAll = asyncHandler(async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const update = asyncHandler(async (req, res) => {
  const { amount, category, date, description } = req.body;
  if (!amount || !category) return res.status(400).json({ error: 'Amount and category are required' });
  if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { amount: Number(amount), category: sanitizeString(category, 50), date: date ? new Date(date) : undefined, description: sanitizeString(description || '', 500) },
      { new: true }
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    console.error('[EXPENSE PUT] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[EXPENSE DELETE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { create, getAll, update, remove };
