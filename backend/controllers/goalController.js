const { Goal } = require('../models');
const { sanitizeString, validateAmount, dateOnly, fmtAmount } = require('../utils/helpers');
const { VALID_PRIORITIES } = require('../config/constants');
const asyncHandler = require('../middleware/asyncHandler');

function computeGoalStatus(goal) {
  if (goal.status === 'paused') return 'paused';
  if (goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount) return 'achieved';
  if (goal.targetDate) {
    const today = dateOnly(new Date());
    const targetDay = dateOnly(goal.targetDate);
    if (targetDay < today && goal.savedAmount < goal.targetAmount) return 'overdue';
  }
  return 'active';
}

function applyGoalStatus(goal) {
  const computed = computeGoalStatus(goal);
  if (goal.status !== computed) {
    goal.status = computed;
    goal.updatedAt = Date.now();
  }
  return goal;
}

const create = asyncHandler(async (req, res) => {
  const { goalName, category, targetAmount, monthlySaving, targetDate, priority } = req.body;
  if (!goalName || !category || !targetAmount || !targetDate) return res.status(400).json({ error: 'Goal name, category, target amount, and target date are required' });
  if (!validateAmount(targetAmount) || Number(targetAmount) <= 0) return res.status(400).json({ error: 'Target amount must be a positive number' });
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Priority must be high, medium, or low' });
  try {
    const goal = new Goal({
      userId: req.userId, goalName: sanitizeString(goalName, 100), category: sanitizeString(category, 50),
      targetAmount: Number(targetAmount), savedAmount: 0, monthlySaving: monthlySaving ? Number(monthlySaving) : 0,
      targetDate: new Date(targetDate), priority: priority || 'medium',
    });
    applyGoalStatus(goal);
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    console.error('[GOALS POST] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAll = asyncHandler(async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    const bulkOps = [];
    for (const g of goals) {
      const prev = g.status;
      applyGoalStatus(g);
      if (g.status !== prev) bulkOps.push({ updateOne: { filter: { _id: g._id }, update: { $set: { status: g.status, updatedAt: new Date() } } } });
    }
    if (bulkOps.length > 0) await Goal.bulkWrite(bulkOps, { ordered: false });
    res.json(goals);
  } catch (err) {
    console.error('[GOALS GET] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const update = asyncHandler(async (req, res) => {
  const { goalName, category, targetAmount, monthlySaving, targetDate, priority } = req.body;
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goalName !== undefined) goal.goalName = sanitizeString(goalName, 100);
    if (category !== undefined) goal.category = sanitizeString(category, 50);
    if (targetAmount !== undefined) {
      if (!validateAmount(targetAmount) || Number(targetAmount) <= 0) return res.status(400).json({ error: 'Target amount must be a positive number' });
      goal.targetAmount = Number(targetAmount);
    }
    if (monthlySaving !== undefined) goal.monthlySaving = Number(monthlySaving) || 0;
    if (targetDate !== undefined) goal.targetDate = new Date(targetDate);
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Priority must be high, medium, or low' });
      goal.priority = priority;
    }
    goal.updatedAt = Date.now();
    applyGoalStatus(goal);
    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error('[GOALS PUT] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    const deleted = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Goal not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[GOALS DELETE] Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const addContribution = asyncHandler(async (req, res) => {
  const { amount, date, note } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Invalid contribution amount' });
  try {
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    goal.contributions.push({ amount: numAmount, date: date || Date.now(), note: note || '' });
    goal.savedAmount = (goal.savedAmount || 0) + numAmount;
    goal.updatedAt = Date.now();
    applyGoalStatus(goal);
    goal.markModified('contributions');
    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error('[GOALS CONTRIB] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const getAnalytics = asyncHandler(async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
    for (const g of goals) applyGoalStatus(g);
    const now = new Date();
    const activeGoals = goals.filter(g => g.status === 'active');
    const achievedGoals = goals.filter(g => g.status === 'achieved');
    const overdueGoals = goals.filter(g => g.status === 'overdue');
    const pausedGoals = goals.filter(g => g.status === 'paused');
    const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
    const remaining = Math.max(totalTarget - totalSaved, 0);
    const completionPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    const todayDate = dateOnly(now);
    const upcomingDeadlines = goals.filter(g => {
      if (g.status !== 'active' && g.status !== 'overdue') return false;
      if (!g.targetDate) return false;
      const targetDay = dateOnly(g.targetDate);
      const daysLeft = Math.ceil((targetDay - todayDate) / (1000 * 60 * 60 * 24));
      return daysLeft >= -30 && daysLeft <= 30;
    }).sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
    const timelineGoals = goals.filter(g => (g.status === 'active' || g.status === 'overdue') && g.targetDate).sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate)).slice(0, 6);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];
    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const label = `${months[m]}${y !== now.getFullYear() ? ' ' + y : ''}`;
      let monthActual = 0; let monthPlanned = 0;
      goals.forEach(g => {
        const contribs = (g.contributions || []).filter(c => { const cd = new Date(c.date); return cd.getMonth() === m && cd.getFullYear() === y; });
        monthActual += contribs.reduce((s, c) => s + c.amount, 0);
        if (g.status === 'active' || g.status === 'overdue') {
          const goalCreated = new Date(g.createdAt || 0);
          if (y > goalCreated.getFullYear() || (y === goalCreated.getFullYear() && m >= goalCreated.getMonth())) monthPlanned += g.monthlySaving || 0;
        }
      });
      monthlyData.push({ label, actual: monthActual, planned: monthPlanned });
    }
    const categoryMap = {};
    goals.forEach(g => { if (!categoryMap[g.category]) categoryMap[g.category] = 0; categoryMap[g.category] += g.targetAmount || 0; });
    const categoryDistribution = Object.entries(categoryMap).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
    const recommendations = [];
    if (goals.length === 0) {
      recommendations.push({ priority: 'good', text: 'Create your first financial goal to start planning your future.' });
    } else {
      overdueGoals.forEach(g => { const rem = Math.max(g.targetAmount - g.savedAmount, 0); recommendations.push({ priority: 'critical', text: `"${g.goalName}" is overdue! ${fmtAmount(rem)} still needed.` }); });
      activeGoals.forEach(g => {
        const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
        const rem = Math.max(g.targetAmount - g.savedAmount, 0);
        const monthsLeft = g.targetDate ? Math.max(1, Math.ceil((new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24 * 30))) : 12;
        const neededMonthly = rem / monthsLeft;
        if (pct < 30 && g.priority === 'high') recommendations.push({ priority: 'critical', text: `"${g.goalName}" is high-priority with only ${Math.round(pct)}% progress. Save at least ${fmtAmount(neededMonthly)}/month.` });
        else if (g.monthlySaving > 0 && neededMonthly > g.monthlySaving * 1.5) recommendations.push({ priority: 'moderate', text: `"${g.goalName}" needs ${fmtAmount(neededMonthly)}/month but you save ${fmtAmount(g.monthlySaving)}/month.` });
        else if (pct >= 100) recommendations.push({ priority: 'good', text: `"${g.goalName}" is complete!` });
      });
      const emergency = activeGoals.find(g => g.category === 'Emergency Fund');
      if (emergency && emergency.savedAmount < emergency.targetAmount * 0.5) recommendations.push({ priority: 'critical', text: 'Emergency Fund should be your highest priority.' });
      if (activeGoals.length + overdueGoals.length > 3) recommendations.push({ priority: 'moderate', text: `You have ${activeGoals.length + overdueGoals.length} goals needing attention.` });
    }
    const achievements = [];
    const totalContribs = goals.reduce((s, g) => s + (g.contributions || []).length, 0);
    achievements.push({ icon: '🎯', title: 'First Goal', desc: 'Created your first goal', unlocked: goals.length > 0 });
    achievements.push({ icon: '💰', title: `Saved ${fmtAmount(50000)}`, desc: `Accumulated ${fmtAmount(50000)}`, unlocked: totalSaved >= 50000 });
    achievements.push({ icon: '🏆', title: 'First Achievement', desc: 'Completed first goal', unlocked: achievedGoals.length >= 1 });
    achievements.push({ icon: '📊', title: '10 Contributions', desc: 'Made 10 contributions', unlocked: totalContribs >= 10 });
    achievements.push({ icon: '👑', title: 'Goal Master', desc: 'Completed 3+ goals', unlocked: achievedGoals.length >= 3 });
    achievements.push({ icon: '💎', title: `Saved ${fmtAmount(100000)}`, desc: `Accumulated ${fmtAmount(100000)}`, unlocked: totalSaved >= 100000 });
    res.json({
      summary: { total: goals.length, active: activeGoals.length, achieved: achievedGoals.length, overdue: overdueGoals.length, paused: pausedGoals.length, totalTarget, totalSaved, remaining, completionPct, upcomingDeadlines: upcomingDeadlines.length },
      upcomingDeadlines, timelineGoals, monthlyData, categoryDistribution, recommendations: recommendations.slice(0, 5), achievements, goals,
    });
  } catch (err) {
    console.error('[GOALS ANALYTICS] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { create, getAll, update, remove, addContribution, getAnalytics, applyGoalStatus };
