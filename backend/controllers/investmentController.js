const { Investment } = require('../models');
const { sanitizeString, validateAmount } = require('../utils/helpers');
const { VALID_INVESTMENT_STATUSES } = require('../config/constants');
const asyncHandler = require('../middleware/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes } = req.body;
  if (!name || !type || !category || !amount) return res.status(400).json({ error: 'Name, type, category, and amount are required' });
  if (!validateAmount(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
  if (status && !VALID_INVESTMENT_STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be active, closed, or paused' });
  try {
    const investment = new Investment({
      userId: req.userId, name: sanitizeString(name, 100), type: sanitizeString(type, 50),
      category: sanitizeString(category, 50), amount: Number(amount),
      currentValue: currentValue != null ? Number(currentValue) : Number(amount),
      investedDate: investedDate ? new Date(investedDate) : new Date(),
      expectedReturns: expectedReturns ? Number(expectedReturns) : 0, status: status || 'active',
      notes: sanitizeString(notes || '', 500),
    });
    await investment.save();
    res.status(201).json(investment);
  } catch (err) {
    console.error('[INVESTMENT POST] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAll = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(investments);
  } catch (err) {
    console.error('[INVESTMENT GET] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const update = asyncHandler(async (req, res) => {
  const { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes } = req.body;
  if (amount !== undefined && (!validateAmount(amount) || Number(amount) <= 0)) return res.status(400).json({ error: 'Amount must be a positive number' });
  if (status && !VALID_INVESTMENT_STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be active, closed, or paused' });
  try {
    const updateFields = { updatedAt: Date.now() };
    if (name !== undefined) updateFields.name = sanitizeString(name, 100);
    if (type !== undefined) updateFields.type = sanitizeString(type, 50);
    if (category !== undefined) updateFields.category = sanitizeString(category, 50);
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (currentValue !== undefined) updateFields.currentValue = Number(currentValue);
    if (investedDate !== undefined) updateFields.investedDate = new Date(investedDate);
    if (expectedReturns !== undefined) updateFields.expectedReturns = Number(expectedReturns);
    if (status !== undefined) updateFields.status = status;
    if (notes !== undefined) updateFields.notes = sanitizeString(notes, 500);
    const investment = await Investment.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, updateFields, { new: true });
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    res.json(investment);
  } catch (err) {
    console.error('[INVESTMENT PUT] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    const deleted = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Investment not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[INVESTMENT DELETE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAnalytics = asyncHandler(async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId });
    const active = investments.filter(inv => inv.status === 'active');
    const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
    const totalReturns = totalCurrentValue - totalInvested;
    const returnPct = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;
    const categoryBreakdown = {};
    investments.forEach(inv => {
      if (!categoryBreakdown[inv.category]) categoryBreakdown[inv.category] = { category: inv.category, invested: 0, currentValue: 0, count: 0 };
      categoryBreakdown[inv.category].invested += inv.amount || 0;
      categoryBreakdown[inv.category].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      categoryBreakdown[inv.category].count += 1;
    });
    const typeBreakdown = {};
    investments.forEach(inv => {
      if (!typeBreakdown[inv.type]) typeBreakdown[inv.type] = { type: inv.type, invested: 0, currentValue: 0, count: 0 };
      typeBreakdown[inv.type].invested += inv.amount || 0;
      typeBreakdown[inv.type].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      typeBreakdown[inv.type].count += 1;
    });
    const performance = investments.map(inv => {
      const curr = inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
      const profit = curr - (inv.amount || 0);
      const retPct = inv.amount > 0 ? ((profit / inv.amount) * 100) : 0;
      return { _id: inv._id, name: inv.name, type: inv.type, category: inv.category, amount: inv.amount, currentValue: curr, profit, returnPct: Math.round(retPct * 100) / 100, status: inv.status, investedDate: inv.investedDate };
    }).sort((a, b) => b.returnPct - a.returnPct);
    const bestPerformer = performance[0] || null;
    const worstPerformer = performance.length > 0 ? performance[performance.length - 1] : null;
    const typeBreakdownArr = Object.values(typeBreakdown);
    const categoryBreakdownArr = Object.values(categoryBreakdown);
    const numTypes = typeBreakdownArr.length;
    const numCategories = categoryBreakdownArr.length;
    const maxTypeAllocation = totalCurrentValue > 0 ? Math.max(...typeBreakdownArr.map(t => (t.currentValue / totalCurrentValue) * 100)) : 0;
    const concentrationRatio = Math.round(maxTypeAllocation * 100) / 100;
    const diversificationScore = numTypes === 0 ? 0 : Math.min(100, Math.round((Math.min(numTypes, 6) / 6) * 60 + (numCategories >= 3 ? 20 : numCategories * 6.67) + (concentrationRatio < 40 ? 20 : concentrationRatio < 60 ? 10 : 0)));
    const diversificationLabel = diversificationScore >= 70 ? 'Well Diversified' : diversificationScore >= 40 ? 'Moderately Diversified' : 'Concentrated';
    res.json({
      summary: { totalInvested, totalCurrentValue, totalReturns, returnPct: Math.round(returnPct * 100) / 100, activeCount: active.length, totalCount: investments.length },
      categoryBreakdown: categoryBreakdownArr.sort((a, b) => b.currentValue - a.currentValue),
      typeBreakdown: typeBreakdownArr.sort((a, b) => b.currentValue - a.currentValue),
      performance, bestPerformer, worstPerformer,
      diversification: { score: diversificationScore, label: diversificationLabel, numTypes, numCategories, concentrationRatio },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { create, getAll, update, remove, getAnalytics };
