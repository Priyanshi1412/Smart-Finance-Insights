const { Notification, Expense, Budget, Goal, Investment, Income } = require('../models');
const { fmtAmount } = require('../utils/helpers');
const asyncHandler = require('../middleware/asyncHandler');

const getAll = asyncHandler(async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('[NOTIFICATIONS GET] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const markAsRead = asyncHandler(async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { read: true }, { new: true });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    console.error('[NOTIFICATION READ] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const markAllRead = asyncHandler(async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error('[NOTIFICATIONS READ ALL] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const remove = asyncHandler(async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    console.error('[NOTIFICATION DELETE] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const generate = asyncHandler(async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId });
    const budgets = await Budget.find({ userId: req.userId });
    const goals = await Goal.find({ userId: req.userId });
    const investments = await Investment.find({ userId: req.userId });
    const incomes = await Income.find({ userId: req.userId });
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const newNotifications = [];
    const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
    const categoryTotals = {};
    expenses.filter(e => { const m = new Date(e.date).toISOString().slice(0, 7); return m === currentMonth; }).forEach(e => { const cat = e.category || 'Other'; categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0); });
    currentMonthBudgets.forEach(b => {
      const spent = categoryTotals[b.category] || 0;
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      if (pct >= 100) newNotifications.push({ userId: req.userId, type: 'budget_exceeded', title: `Budget Exceeded: ${b.category}`, message: `You've exceeded your ${b.category} budget by ${fmtAmount(spent - b.limit)}.`, priority: 'critical', category: b.category, amount: spent });
      else if (pct >= 80) newNotifications.push({ userId: req.userId, type: 'budget_warning', title: `Budget Warning: ${b.category}`, message: `Your ${b.category} budget is at ${Math.round(pct)}%.`, priority: 'medium', category: b.category, amount: spent });
    });
    goals.forEach(g => {
      if (g.status === 'overdue') newNotifications.push({ userId: req.userId, type: 'goal_overdue', title: `Goal Overdue: ${g.goalName}`, message: `"${g.goalName}" has passed its target date.`, priority: 'high', category: g.category });
      else if (g.status === 'active' && g.targetDate) {
        const daysLeft = Math.ceil((new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24));
        const pct = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
        const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
        if (daysLeft <= 7 && daysLeft > 0) newNotifications.push({ userId: req.userId, type: 'goal_deadline_urgent', title: `Urgent: ${g.goalName} Due Soon`, message: `Deadline in ${daysLeft} days! ${pct}% saved.`, priority: 'high', category: g.category });
        else if (daysLeft <= 30 && daysLeft > 7) newNotifications.push({ userId: req.userId, type: 'goal_reminder', title: `Goal Deadline: ${g.goalName}`, message: `Deadline in ${daysLeft} days. ${pct}% progress.`, priority: 'medium', category: g.category });
        if (g.monthlySaving > 0 && daysLeft > 0) { const monthsLeft = daysLeft / 30; const neededPerMonth = remaining / monthsLeft; if (neededPerMonth > g.monthlySaving * 1.5) newNotifications.push({ userId: req.userId, type: 'goal_reminder', title: `Goal Behind Schedule: ${g.goalName}`, message: `Need ${fmtAmount(neededPerMonth)}/month.`, priority: 'high', category: g.category }); }
      }
    });
    investments.filter(inv => inv.status === 'active').forEach(inv => {
      const curr = inv.currentValue != null ? inv.currentValue : inv.amount;
      const retPct = inv.amount > 0 ? ((curr - inv.amount) / inv.amount) * 100 : 0;
      if (retPct < -10) newNotifications.push({ userId: req.userId, type: 'investment_loss', title: `Investment Loss: ${inv.name}`, message: `${inv.name} declined ${Math.abs(Math.round(retPct))}%.`, priority: 'high' });
      else if (retPct > 15) newNotifications.push({ userId: req.userId, type: 'investment_gain', title: `Investment Gain: ${inv.name}`, message: `${inv.name} gained ${Math.round(retPct)}%.`, priority: 'low' });
    });
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    if (totalIncome > 0) { const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100; if (savingsRate < 10 && totalExpenses > 0) newNotifications.push({ userId: req.userId, type: 'low_savings', title: 'Low Savings Alert', message: `Savings rate only ${Math.round(savingsRate)}%.`, priority: 'high' }); }
    const getMonthKey = (date) => new Date(date).toISOString().slice(0, 7);
    const monthCounts = {};
    expenses.forEach(e => { const m = getMonthKey(e.date); monthCounts[m] = (monthCounts[m] || 0) + 1; });
    const sortedMonths = Object.keys(monthCounts).sort().reverse();
    const prevMonths = sortedMonths.filter(m => m < currentMonth).slice(0, 3);
    if (prevMonths.length >= 2) {
      const prevCategoryTotals = {};
      const prevMonthCount = prevMonths.length;
      expenses.filter(e => prevMonths.includes(getMonthKey(e.date))).forEach(e => { const cat = e.category || 'Other'; prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + Number(e.amount || 0); });
      Object.keys(categoryTotals).forEach(cat => { const currentSpent = categoryTotals[cat]; const prevAvg = (prevCategoryTotals[cat] || 0) / prevMonthCount; if (prevAvg > 0 && currentSpent > prevAvg * 1.5) { const increasePct = Math.round(((currentSpent - prevAvg) / prevAvg) * 100); newNotifications.push({ userId: req.userId, type: 'unusual_spending', title: `Unusual Spending: ${cat}`, message: `Your ${cat} spending is ${increasePct}% higher than average.`, priority: 'high', category: cat, amount: currentSpent }); } });
    }
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    investments.filter(inv => inv.status === 'active').forEach(inv => {
      const lastUpdated = inv.updatedAt || inv.createdAt;
      const daysSinceUpdate = Math.floor((now - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate > 90) newNotifications.push({ userId: req.userId, type: 'investment_reminder', title: `Review Investment: ${inv.name}`, message: `"${inv.name}" hasn't been updated in ${daysSinceUpdate} days.`, priority: 'medium' });
      if (inv.expectedReturns > 0 && inv.amount > 0) { const actualReturn = inv.currentValue > 0 ? ((inv.currentValue - inv.amount) / inv.amount) * 100 : 0; const timeHeld = Math.max(1, Math.floor((now - new Date(inv.investedDate)) / (1000 * 60 * 60 * 24))); const annualizedExpected = inv.expectedReturns; const annualizedActual = (actualReturn / timeHeld) * 365; if (timeHeld > 180 && annualizedActual < annualizedExpected * 0.5) newNotifications.push({ userId: req.userId, type: 'investment_reminder', title: `Underperforming: ${inv.name}`, message: `Returning ${Math.round(annualizedActual)}% vs expected ${annualizedExpected}%.`, priority: 'medium' }); }
    });
    const existingTypes = newNotifications.map(n => `${n.type}_${n.category || ''}`);
    const uniqueNew = newNotifications.filter((n, i) => { const key = `${n.type}_${n.category || ''}`; return existingTypes.indexOf(key) === i; });
    let created = [];
    if (uniqueNew.length > 0) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const existingNotifs = await Notification.find({ userId: req.userId, createdAt: { $gte: thirtyDaysAgo } }).select('type category').lean();
      const existingSet = new Set(existingNotifs.map(n => `${n.type}_${n.category || ''}`));
      const toInsert = uniqueNew.filter(n => { const key = `${n.type}_${n.category || ''}`; return !existingSet.has(key); });
      if (toInsert.length > 0) { const inserted = await Notification.insertMany(toInsert, { ordered: false }); created = inserted; }
    }
    const allNotifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ notifications: allNotifications, unreadCount, newCount: created.length });
  } catch (err) {
    console.error('[NOTIFICATIONS GENERATE] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getAll, markAsRead, markAllRead, remove, generate };
