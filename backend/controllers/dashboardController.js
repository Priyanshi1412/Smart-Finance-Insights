const mongoose = require('mongoose');
const { Income, Expense, Budget } = require('../models');
const asyncHandler = require('../middleware/asyncHandler');

const getSummary = asyncHandler(async (req, res) => {
  try {
    const income = await Income.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const expenses = await Expense.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const budgets = await Budget.find({ userId: req.userId });
    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
    const totalIncome = income[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const savings = totalIncome - totalExpenses;
    const percentUsed = totalBudget > 0 ? Math.min((totalExpenses / totalBudget) * 100, 100) : 0;
    let status = 'On Track';
    if (totalBudget > 0 && totalExpenses >= totalBudget) status = 'Exceeded';
    else if (totalBudget > 0 && totalExpenses >= totalBudget * 0.8) status = 'Near Limit';
    res.json({ totalIncome, totalExpenses, savings, budget: { status, percentUsed, limit: totalBudget } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const getRecentTransactions = asyncHandler(async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.userId }).sort({ date: -1 }).limit(5).lean();
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 }).limit(5).lean();
    const transactions = [
      ...incomes.map(i => ({ ...i, type: 'income', name: i.source, category: 'Income' })),
      ...expenses.map(e => ({ ...e, type: 'expense', name: e.category, category: e.category }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getSummary, getRecentTransactions };
