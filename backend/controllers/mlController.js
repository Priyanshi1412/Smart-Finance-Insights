const mlService = require('../services/mlService');
const { Income, Expense, Budget, Goal, Investment } = require('../models');
const asyncHandler = require('../middleware/asyncHandler');

const getHealth = asyncHandler(async (req, res) => {
  try {
    const healthy = await mlService.checkHealth();
    res.json({ mlServiceAvailable: healthy });
  } catch (err) {
    res.json({ mlServiceAvailable: false });
  }
});

const getFinancialInsights = asyncHandler(async (req, res) => {
  try {
    const result = await mlService.getFinancialInsights(req.userId, Income, Expense, Budget, Goal, Investment);
    if (result.ok) res.json(result.data);
    else res.status(503).json({ error: result.error, fallback: true });
  } catch (err) {
    console.error('[ML ROUTE] financial-insights error:', err.message);
    res.status(500).json({ error: 'ML service error', fallback: true });
  }
});

const getPredictions = asyncHandler(async (req, res) => {
  try {
    const result = await mlService.getPredictions(req.userId, Income, Expense);
    if (result.ok) res.json(result.data);
    else res.status(503).json({ error: result.error, fallback: true });
  } catch (err) {
    console.error('[ML ROUTE] predictions error:', err.message);
    res.status(500).json({ error: 'ML service error', fallback: true });
  }
});

const analyze = asyncHandler(async (req, res) => {
  try {
    const [incomes, expenses, budgets, goals, investments] = await Promise.all([
      Income.find({ userId: req.userId }).sort({ date: -1 }).limit(120).lean(),
      Expense.find({ userId: req.userId }).sort({ date: -1 }).limit(120).lean(),
      Budget.find({ userId: req.userId }).lean(),
      Goal.find({ userId: req.userId }).lean(),
      Investment.find({ userId: req.userId }).lean(),
    ]);
    const monthlyData = mlService.buildMonthlyData(incomes, expenses, goals, investments);
    const result = await mlService.callML('/analyze', { monthly: monthlyData });
    if (result.ok) res.json(result.data);
    else res.status(503).json({ error: result.error, fallback: true });
  } catch (err) {
    console.error('[ML ROUTE] analyze error:', err.message);
    res.status(500).json({ error: 'ML service error', fallback: true });
  }
});

module.exports = { getHealth, getFinancialInsights, getPredictions, analyze };
