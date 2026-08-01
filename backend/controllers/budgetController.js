const { Budget } = require('../models');
const { sanitizeString, validateAmount } = require('../utils/helpers');
const asyncHandler = require('../middleware/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const { category, limit, month } = req.body;
  if (!category || !limit || !month) return res.status(400).json({ error: 'Category, limit, and month are required' });
  if (!validateAmount(limit) || Number(limit) <= 0) return res.status(400).json({ error: 'Invalid budget limit' });
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
  try {
    const budget = new Budget({ userId: req.userId, category: sanitizeString(category, 50), limit: Number(limit), month });
    await budget.save();
    res.status(201).json(budget);
  } catch (err) {
    console.error('[BUDGET POST]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAll = asyncHandler(async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.userId }).sort({ month: -1, category: 1 });
    res.json(budgets);
  } catch (err) {
    console.error('[BUDGET GET]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const update = asyncHandler(async (req, res) => {
  const { category, limit, month } = req.body;
  if (!category || !limit || !month) return res.status(400).json({ error: 'Category, limit, and month are required' });
  if (!validateAmount(limit) || Number(limit) <= 0) return res.status(400).json({ error: 'Invalid budget limit' });
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
  try {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { category: sanitizeString(category, 50), limit: Number(limit), month },
      { new: true }
    );
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    res.json(budget);
  } catch (err) {
    console.error('[BUDGET PUT]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    const deleted = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[BUDGET DELETE]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { create, getAll, update, remove };
