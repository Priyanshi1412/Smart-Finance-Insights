const { Income } = require('../models');
const { sanitizeString, validateAmount } = require('../utils/helpers');
const asyncHandler = require('../middleware/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const { amount, source, date, description } = req.body;
  if (!amount || !source) return res.status(400).json({ error: 'Amount and source are required' });
  if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const income = new Income({
      userId: req.userId, amount: Number(amount), source: sanitizeString(source, 100),
      date: date ? new Date(date) : new Date(), description: sanitizeString(description || '', 500),
    });
    await income.save();
    res.status(201).json(income);
  } catch (err) {
    console.error('[INCOME POST] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAll = asyncHandler(async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.userId }).sort({ date: -1 });
    res.json(incomes);
  } catch (err) {
    console.error('[INCOME GET] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const update = asyncHandler(async (req, res) => {
  const { amount, source, date, description } = req.body;
  if (!amount || !source) return res.status(400).json({ error: 'Amount and source are required' });
  if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
  try {
    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { amount: Number(amount), source: sanitizeString(source, 100), date: date ? new Date(date) : undefined, description: sanitizeString(description || '', 500) },
      { new: true }
    );
    if (!income) return res.status(404).json({ error: 'Income not found' });
    res.json(income);
  } catch (err) {
    console.error('[INCOME PUT] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    const deleted = await Income.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Income not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[INCOME DELETE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { create, getAll, update, remove };
