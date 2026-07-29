const { Income, Expense, Budget, Goal, Investment } = require('../models');
const { fmtAmount } = require('../utils/helpers');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/analytics/spending-patterns
const getSpendingPatterns = asyncHandler(async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
    const incomes = await Income.find({ userId: req.userId });
    const now = new Date();
    const categoryTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      if (!categoryTotals[cat]) categoryTotals[cat] = { category: cat, total: 0, count: 0, avgPerTransaction: 0 };
      categoryTotals[cat].total += Number(e.amount || 0);
      categoryTotals[cat].count += 1;
    });
    Object.values(categoryTotals).forEach(c => { c.avgPerTransaction = c.count > 0 ? Math.round(c.total / c.count) : 0; });
    const categorySummary = Object.values(categoryTotals).sort((a, b) => b.total - a.total);
    const totalExpensesAll = categorySummary.reduce((s, c) => s + c.total, 0);
    categorySummary.forEach(c => { c.percentage = totalExpensesAll > 0 ? Math.round((c.total / totalExpensesAll) * 10000) / 100 : 0; });
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
    const monthlySpending = {};
    months.forEach(m => { monthlySpending[m] = { month: m, total: 0, categories: {} }; });
    expenses.forEach(e => {
      const m = new Date(e.date).toISOString().slice(0, 7);
      if (monthlySpending[m]) { monthlySpending[m].total += Number(e.amount || 0); const cat = e.category || 'Other'; monthlySpending[m].categories[cat] = (monthlySpending[m].categories[cat] || 0) + Number(e.amount || 0); }
    });
    const monthlyTrend = months.map(m => ({ ...monthlySpending[m], label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }) }));
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalExpensesVal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    let highestCategory = categorySummary[0] || null;
    let spendingHabits = [];
    if (highestCategory && highestCategory.percentage > 35) spendingHabits.push({ type: 'warning', text: `${highestCategory.category} accounts for ${highestCategory.percentage}% of your total spending.` });
    if (totalIncome > 0 && (totalExpensesVal / totalIncome) > 0.8) spendingHabits.push({ type: 'critical', text: `You're spending ${Math.round((totalExpensesVal / totalIncome) * 100)}% of your income.` });
    const avgMonthlySpend = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.total, 0) / monthlyTrend.length : 0;
    if (monthlyTrend.length >= 2) {
      const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.total || 0;
      const prevMonth = monthlyTrend[monthlyTrend.length - 2]?.total || 0;
      if (prevMonth > 0 && lastMonth > prevMonth * 1.2) spendingHabits.push({ type: 'warning', text: `Spending increased by ${Math.round(((lastMonth - prevMonth) / prevMonth) * 100)}% last month.` });
    }
    res.json({ categorySummary, monthlyTrend, totalExpenses: totalExpensesAll, totalIncome, avgMonthlySpend: Math.round(avgMonthlySpend), highestCategory, spendingHabits, transactionCount: expenses.length });
  } catch (err) {
    console.error('[SPENDING PATTERNS] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/budget-recommendations
const getBudgetRecommendations = asyncHandler(async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId });
    const budgets = await Budget.find({ userId: req.userId });
    const incomes = await Income.find({ userId: req.userId });
    const investments = await Investment.find({ userId: req.userId });
    const goals = await Goal.find({ userId: req.userId });
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const categoryTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0, monthly: {} };
      categoryTotals[cat].total += Number(e.amount || 0);
      categoryTotals[cat].count += 1;
      const m = new Date(e.date).toISOString().slice(0, 7);
      categoryTotals[cat].monthly[m] = (categoryTotals[cat].monthly[m] || 0) + Number(e.amount || 0);
    });
    const curMonthExpenses = expenses.filter(e => new Date(e.date).toISOString().slice(0, 7) === currentMonth);
    const prevMonthExpenses = expenses.filter(e => new Date(e.date).toISOString().slice(0, 7) === prevMonth);
    const totalCurMonth = curMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalPrevMonth = prevMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const curMonthIncome = incomes.filter(i => new Date(i.date).toISOString().slice(0, 7) === currentMonth).reduce((s, i) => s + Number(i.amount || 0), 0);
    const prevMonthIncome = incomes.filter(i => new Date(i.date).toISOString().slice(0, 7) === prevMonth).reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
    const budgetByCategory = {};
    currentMonthBudgets.forEach(b => { budgetByCategory[b.category] = b.limit; });
    const recommendations = [];
    const overspendingAlerts = [];
    let recId = 0;
    const addRec = (type, priority, category, title, message, data = {}) => { recommendations.push({ id: recId++, type, priority, category, title, message, ...data }); };
    const curMonthCatTotals = {};
    curMonthExpenses.forEach(e => { const cat = e.category || 'Other'; curMonthCatTotals[cat] = (curMonthCatTotals[cat] || 0) + Number(e.amount || 0); });
    Object.entries(categoryTotals).forEach(([cat, data]) => {
      const monthlyAmounts = Object.entries(data.monthly).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3).map(([, v]) => v);
      const avgMonthly = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((s, v) => s + v, 0) / monthlyAmounts.length : 0;
      const currentBudget = budgetByCategory[cat];
      const curSpent = curMonthCatTotals[cat] || 0;
      if (currentBudget) {
        const pct = currentBudget > 0 ? (curSpent / currentBudget) * 100 : 0;
        if (pct >= 100) { const overBy = Math.round(curSpent - currentBudget); const suggestedCut = Math.round(overBy * 1.1); overspendingAlerts.push({ category: cat, spent: curSpent, limit: currentBudget, overBy, percentage: Math.round(pct) }); addRec('reduce', 'high', cat, `Reduce ${cat} spending`, `You exceeded your ${cat} budget by ${fmtAmount(overBy)} this month.`, { currentSpent: curSpent, limit: currentBudget, overBy, suggestedBudget: Math.round(currentBudget - suggestedCut) }); }
        else if (pct >= 80) { const remaining = Math.round(currentBudget - curSpent); addRec('monitor', 'medium', cat, `Monitor ${cat} budget`, `${cat} is at ${Math.round(pct)}% — only ${fmtAmount(remaining)} left.`, { currentSpent: curSpent, limit: currentBudget, remaining }); }
        else if (pct < 30 && monthlyAmounts.length >= 2 && avgMonthly > 0) { addRec('optimize', 'low', cat, `Optimize ${cat} budget`, `You've only used ${Math.round(pct)}% of your ${cat} budget.`, { currentSpent: curSpent, limit: currentBudget }); }
      } else if (data.count >= 3 && avgMonthly > 0) { const suggested = Math.round(avgMonthly * 1.1); addRec('create', 'medium', cat, `Create a ${cat} budget`, `You've spent ${fmtAmount(Math.round(avgMonthly))}/month on ${cat}.`, { suggestedBudget: suggested, avgMonthly: Math.round(avgMonthly) }); }
    });
    if (curMonthIncome > 0) {
      const curMonthSavings = curMonthIncome - totalCurMonth;
      const curSavingsRate = (curMonthSavings / curMonthIncome) * 100;
      if (curSavingsRate < 20) { const targetSavings = Math.round(curMonthIncome * 0.2); const gap = Math.max(0, targetSavings - curMonthSavings); if (gap > 0) addRec('increase_savings', 'high', null, 'Increase monthly savings', `Your savings rate is ${curSavingsRate.toFixed(1)}%. Save an additional ${fmtAmount(gap)}.`, { currentSavings: Math.round(curMonthSavings), targetSavings, gap, savingsRate: curSavingsRate.toFixed(1) }); }
      else if (curSavingsRate >= 20 && curSavingsRate < 40) addRec('good', 'low', null, 'Healthy savings rate', `Saving ${curSavingsRate.toFixed(1)}%.`, { savingsRate: curSavingsRate.toFixed(1) });
      else if (curSavingsRate >= 40) addRec('good', 'low', null, 'Excellent savings rate', `At ${curSavingsRate.toFixed(1)}%.`, { savingsRate: curSavingsRate.toFixed(1) });
    }
    const discretionaryCategories = ['Shopping', 'Entertainment', 'Food & Dining', 'Travel', 'Subscriptions', 'Personal Care'];
    let totalDiscretionary = 0;
    discretionaryCategories.forEach(cat => { totalDiscretionary += curMonthCatTotals[cat] || 0; });
    if (curMonthIncome > 0 && totalDiscretionary > 0) {
      const discretionaryPct = (totalDiscretionary / curMonthIncome) * 100;
      if (discretionaryPct > 30) { const reduceTarget = Math.round(totalDiscretionary * 0.2); const topDiscCat = discretionaryCategories.map(c => ({ cat: c, amt: curMonthCatTotals[c] || 0 })).filter(c => c.amt > 0).sort((a, b) => b.amt - a.amt)[0]; addRec('reduce_discretionary', 'high', topDiscCat?.cat || 'Shopping', 'Reduce discretionary spending', `Non-essential spending is ${discretionaryPct.toFixed(0)}% of income.`, { totalDiscretionary, discretionaryPct: discretionaryPct.toFixed(1), topCategory: topDiscCat?.cat }); }
    }
    if (totalPrevMonth > 0) {
      const expDiff = totalCurMonth - totalPrevMonth;
      const expPctChange = Math.round((expDiff / totalPrevMonth) * 100);
      if (expPctChange > 10) { const catDiffs = []; Object.keys(curMonthCatTotals).forEach(cat => { const cur = curMonthCatTotals[cat] || 0; const prev = categoryTotals[cat]?.monthly[prevMonth] || 0; if (cur > prev && cur - prev > 0) catDiffs.push({ cat, diff: Math.round(cur - prev) }); }); catDiffs.sort((a, b) => b.diff - a.diff); const topIncrease = catDiffs[0]; addRec('trend_warning', 'high', topIncrease?.cat || null, `Expenses increased ${expPctChange}%`, `Spending rose from ${fmtAmount(totalPrevMonth)} to ${fmtAmount(totalCurMonth)}.`, { prevMonth: totalPrevMonth, curMonth: totalCurMonth, change: expPctChange }); }
      else if (expPctChange < -5) addRec('good', 'low', null, `Expenses reduced by ${Math.abs(expPctChange)}%`, `Expenses dropped from ${fmtAmount(totalPrevMonth)} to ${fmtAmount(totalCurMonth)}.`, { prevMonth: totalPrevMonth, curMonth: totalCurMonth, change: expPctChange });
    }
    if (prevMonthIncome > 0) {
      const incDiff = curMonthIncome - prevMonthIncome;
      const incPctChange = Math.round((incDiff / prevMonthIncome) * 100);
      if (incPctChange < -10) addRec('trend_warning', 'high', null, `Income dropped ${Math.abs(incPctChange)}%`, `Income fell from ${fmtAmount(prevMonthIncome)} to ${fmtAmount(curMonthIncome)}.`, { prevMonth: prevMonthIncome, curMonth: curMonthIncome, change: incPctChange });
      else if (incPctChange > 10) addRec('good', 'low', null, `Income increased ${incPctChange}%`, `Income grew from ${fmtAmount(prevMonthIncome)} to ${fmtAmount(curMonthIncome)}.`, { prevMonth: prevMonthIncome, curMonth: curMonthIncome, change: incPctChange });
    }
    const emergencyFund = goals.find(g => g.category === 'Emergency Fund');
    const monthsOfData = Math.max(1, Object.keys(categoryTotals).reduce((max, c) => Math.max(max, Object.keys(categoryTotals[c]?.monthly || {}).length), 0) || 1);
    const monthlyExpenses = totalCurMonth > 0 ? totalCurMonth : (totalExpenses / monthsOfData);
    if (!emergencyFund) { const targetAmount = Math.round(monthlyExpenses * 6); addRec('emergency_fund', 'high', null, 'Create an emergency fund', `Aim for ${fmtAmount(targetAmount)} (6 months of expenses).`, { targetAmount, monthlyExpenses: Math.round(monthlyExpenses) }); }
    else if (emergencyFund.targetAmount > 0) { const efPct = (emergencyFund.savedAmount / emergencyFund.targetAmount) * 100; if (efPct < 50) { const remaining = emergencyFund.targetAmount - emergencyFund.savedAmount; addRec('emergency_fund', 'medium', null, 'Build your emergency fund', `Emergency fund is ${efPct.toFixed(0)}% complete.`, { savedAmount: emergencyFund.savedAmount, targetAmount: emergencyFund.targetAmount, progress: efPct.toFixed(0) }); } }
    const sortedCats = Object.entries(curMonthCatTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0 && totalCurMonth > 0) { const [topCat, topAmt] = sortedCats[0]; const topPct = (topAmt / totalCurMonth) * 100; if (topPct > 35) { const reduceAmt = Math.round(topAmt * 0.15); addRec('reduce', 'medium', topCat, `${topCat} dominates spending`, `${topCat} accounts for ${topPct.toFixed(0)}% of expenses.`, { category: topCat, amount: topAmt, percentage: topPct.toFixed(0), suggestedReduction: reduceAmt }); } }
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
    res.json({
      recommendations: recommendations.slice(0, 10), overspendingAlerts, currentMonthBudgets,
      categorySpending: Object.entries(categoryTotals).map(([cat, data]) => ({ category: cat, total: data.total, count: data.count, currentMonth: data.monthly[currentMonth] || 0 })).sort((a, b) => b.total - a.total),
      summary: { totalIncome, totalExpenses, curMonthIncome, curMonthExpenses: totalCurMonth, prevMonthExpenses: totalPrevMonth, savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 10) / 10 : 0 },
    });
  } catch (err) {
    console.error('[BUDGET RECOMMENDATIONS] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/financial-health
const getFinancialHealth = asyncHandler(async (req, res) => {
  try {
    const incomes = await Income.find({ userId: req.userId });
    const expenses = await Expense.find({ userId: req.userId });
    const investments = await Investment.find({ userId: req.userId });
    const goals = await Goal.find({ userId: req.userId });
    const budgets = await Budget.find({ userId: req.userId });
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
    const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100 * 10) / 10 : 0;
    const investmentGrowth = totalInvested > 0 ? Math.round(((totalCurrentValue - totalInvested) / totalInvested) * 100 * 10) / 10 : 0;
    const expenseRatio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100 * 10) / 10 : 0;
    const investmentRatio = totalIncome > 0 ? Math.round((totalInvested / totalIncome) * 100 * 10) / 10 : 0;
    let debtToIncome = 0;
    const debtCategories = ['Rent', 'Bills & Utilities'];
    const debtExpenses = expenses.filter(e => debtCategories.includes(e.category));
    const totalDebt = debtExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    debtToIncome = totalIncome > 0 ? Math.round((totalDebt / totalIncome) * 100 * 10) / 10 : 0;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
    let avgBudgetUtilization = 0;
    let budgetCount = 0;
    const categoryTotals = {};
    expenses.filter(e => { const m = new Date(e.date).toISOString().slice(0, 7); return m === currentMonth; }).forEach(e => { const cat = e.category || 'Other'; categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0); });
    currentMonthBudgets.forEach(b => { const spent = categoryTotals[b.category] || 0; const utilization = b.limit > 0 ? Math.min((spent / b.limit) * 100, 150) : 0; avgBudgetUtilization += utilization; budgetCount++; });
    avgBudgetUtilization = budgetCount > 0 ? Math.round(avgBudgetUtilization / budgetCount) : 0;
    const scoreBreakdown = {};
    if (savingsRate >= 30) scoreBreakdown.savingsRate = { score: 30, max: 30, label: 'Excellent savings habit' };
    else if (savingsRate >= 20) scoreBreakdown.savingsRate = { score: 25, max: 30, label: 'Good savings rate' };
    else if (savingsRate >= 10) scoreBreakdown.savingsRate = { score: 15, max: 30, label: 'Room to save more' };
    else if (savingsRate > 0) scoreBreakdown.savingsRate = { score: 5, max: 30, label: 'Savings rate needs improvement' };
    else scoreBreakdown.savingsRate = { score: 0, max: 30, label: 'No savings detected' };
    if (investmentGrowth > 10) scoreBreakdown.investments = { score: 20, max: 20, label: 'Strong investment returns' };
    else if (investmentGrowth > 0) scoreBreakdown.investments = { score: 15, max: 20, label: 'Positive growth' };
    else if (investmentGrowth === 0 && totalInvested === 0) scoreBreakdown.investments = { score: 10, max: 20, label: 'No investments yet' };
    else scoreBreakdown.investments = { score: 0, max: 20, label: 'Investments need attention' };
    if (expenseRatio < 50) scoreBreakdown.expenses = { score: 20, max: 20, label: 'Expenses well controlled' };
    else if (expenseRatio < 70) scoreBreakdown.expenses = { score: 15, max: 20, label: 'Moderate spending' };
    else if (expenseRatio < 85) scoreBreakdown.expenses = { score: 8, max: 20, label: 'High expense ratio' };
    else scoreBreakdown.expenses = { score: 0, max: 20, label: 'Spending exceeds healthy limits' };
    if (debtToIncome < 15) scoreBreakdown.debt = { score: 15, max: 15, label: 'Low debt burden' };
    else if (debtToIncome < 30) scoreBreakdown.debt = { score: 10, max: 15, label: 'Manageable debt level' };
    else if (debtToIncome < 40) scoreBreakdown.debt = { score: 5, max: 15, label: 'Debt level rising' };
    else scoreBreakdown.debt = { score: 0, max: 15, label: 'High debt burden' };
    const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'overdue');
    const achievedGoals = goals.filter(g => g.status === 'achieved');
    if (goals.length > 0) { const goalCompletion = achievedGoals.length / goals.length; if (goalCompletion >= 0.5) scoreBreakdown.goals = { score: 15, max: 15, label: 'Great goal progress' }; else if (goalCompletion >= 0.25) scoreBreakdown.goals = { score: 10, max: 15, label: 'Making progress on goals' }; else scoreBreakdown.goals = { score: 5, max: 15, label: 'Keep working toward goals' }; }
    else scoreBreakdown.goals = { score: 5, max: 15, label: 'No goals set yet' };
    let score = Object.values(scoreBreakdown).reduce((s, v) => s + v.score, 0);
    score = Math.max(0, Math.min(100, score));
    let status;
    if (score >= 80) status = 'Excellent';
    else if (score >= 60) status = 'Good';
    else if (score >= 40) status = 'Fair';
    else status = 'Poor';
    const insights = [];
    if (savingsRate < 20) insights.push({ type: 'critical', text: `Your savings rate is ${savingsRate}%. Aim for at least 20%.` });
    else if (savingsRate >= 30) insights.push({ type: 'good', text: `Excellent! Saving ${savingsRate}% of income.` });
    if (expenseRatio > 80) insights.push({ type: 'critical', text: `Spending ${expenseRatio}% of income. Reduce below 70%.` });
    else if (expenseRatio < 60) insights.push({ type: 'good', text: `Expense ratio healthy at ${expenseRatio}%.` });
    if (investmentGrowth < 0) insights.push({ type: 'warning', text: `Investments declined ${Math.abs(investmentGrowth)}%.` });
    else if (investmentGrowth > 10) insights.push({ type: 'good', text: `Investments grew ${investmentGrowth}%.` });
    if (debtToIncome > 30) insights.push({ type: 'critical', text: `Debt-to-income is ${debtToIncome}%.` });
    if (avgBudgetUtilization > 100) insights.push({ type: 'critical', text: `Over budget by ${Math.round(avgBudgetUtilization - 100)}%.` });
    else if (avgBudgetUtilization > 80 && avgBudgetUtilization <= 100) insights.push({ type: 'warning', text: `Budget utilization at ${Math.round(avgBudgetUtilization)}%.` });
    else if (avgBudgetUtilization > 0 && avgBudgetUtilization < 60) insights.push({ type: 'good', text: `Budget utilization ${Math.round(avgBudgetUtilization)}%. Well within limits.` });
    if (activeGoals.length > 3) insights.push({ type: 'warning', text: `${activeGoals.length} active goals. Focus on fewer.` });
    const emergencyFund = goals.find(g => g.category === 'Emergency Fund');
    if (emergencyFund) { const efPct = emergencyFund.targetAmount > 0 ? (emergencyFund.savedAmount / emergencyFund.targetAmount) * 100 : 0; if (efPct < 50) insights.push({ type: 'critical', text: `Emergency Fund only ${Math.round(efPct)}% complete.` }); }
    else insights.push({ type: 'warning', text: 'No Emergency Fund goal found.' });
    res.json({ score, status, indicators: { savingsRate, investmentGrowth, expenseRatio, investmentRatio, debtToIncome, avgBudgetUtilization }, summary: { totalIncome, totalExpenses, savings, totalInvested, totalCurrentValue }, scoreBreakdown, insights, activeGoals: activeGoals.length, achievedGoals: achievedGoals.length, totalGoals: goals.length, lastUpdated: new Date() });
  } catch (err) {
    console.error('[FINANCIAL HEALTH] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getSpendingPatterns, getBudgetRecommendations, getFinancialHealth };
