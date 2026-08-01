const { Expense, Budget, Investment, Goal, Income } = require('../models');

function getMonthRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end, year, month };
}

function getPreviousMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return `${prev.year}-${String(prev.month).padStart(2, '0')}`;
}

async function generateMonthlyExpenseReport(userId, monthStr) {
  const { start, end } = getMonthRange(monthStr);
  const prevMonth = getPreviousMonth(monthStr);
  const prevRange = getMonthRange(prevMonth);

  const [currentExpenses, previousExpenses, budgets, incomes] = await Promise.all([
    Expense.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
    Expense.find({ userId, date: { $gte: prevRange.start, $lte: prevRange.end } }),
    Budget.find({ userId, month: monthStr }),
    Income.find({ userId, date: { $gte: start, $lte: end } }),
  ]);

  const totalExpenses = currentExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPrevExpenses = previousExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const categoryBreakdown = {};
  currentExpenses.forEach(e => {
    if (!categoryBreakdown[e.category]) categoryBreakdown[e.category] = 0;
    categoryBreakdown[e.category] += e.amount || 0;
  });

  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0,
    }));

  const highestCategory = sortedCategories[0] || null;
  const lowestCategory = sortedCategories[sortedCategories.length - 1] || null;

  const dailyExpenses = {};
  currentExpenses.forEach(e => {
    const day = new Date(e.date).toISOString().slice(0, 10);
    dailyExpenses[day] = (dailyExpenses[day] || 0) + (e.amount || 0);
  });

  const dailySummary = Object.entries(dailyExpenses)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthOverMonthChange = totalPrevExpenses > 0
    ? Math.round(((totalExpenses - totalPrevExpenses) / totalPrevExpenses) * 10000) / 100
    : null;

  return {
    month: monthStr,
    totalExpenses,
    totalIncome,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100 : 0,
    categoryBreakdown: sortedCategories,
    highestCategory,
    lowestCategory,
    dailySummary,
    transactionCount: currentExpenses.length,
    comparison: {
      previousMonth: prevMonth,
      previousExpenses: totalPrevExpenses,
      change: monthOverMonthChange,
      changeType: monthOverMonthChange !== null ? (monthOverMonthChange > 0 ? 'increase' : monthOverMonthChange < 0 ? 'decrease' : 'same') : null,
    },
    transactions: currentExpenses.map(e => ({
      _id: e._id,
      amount: e.amount,
      category: e.category,
      date: e.date,
      description: e.description,
    })),
  };
}

async function generateBudgetUtilizationReport(userId, monthStr) {
  const { start, end } = getMonthRange(monthStr);

  const [budgets, expenses] = await Promise.all([
    Budget.find({ userId, month: monthStr }),
    Expense.find({ userId, date: { $gte: start, $lte: end } }),
  ]);

  const expenseByCategory = {};
  expenses.forEach(e => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + (e.amount || 0);
  });

  const totalBudget = budgets.reduce((s, b) => s + (b.limit || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (expenseByCategory[b.category] || 0), 0);

  const categories = budgets.map(b => {
    const spent = expenseByCategory[b.category] || 0;
    const remaining = Math.max(b.limit - spent, 0);
    const percentUsed = b.limit > 0 ? Math.round((spent / b.limit) * 10000) / 100 : 0;
    let status = 'Safe';
    if (percentUsed >= 100) status = 'Exceeded';
    else if (percentUsed >= 75) status = 'Warning';

    return {
      category: b.category,
      budgetLimit: b.limit,
      spent,
      remaining,
      percentUsed,
      status,
    };
  }).sort((a, b) => b.percentUsed - a.percentUsed);

  const safeCategories = categories.filter(c => c.status === 'Safe');
  const warningCategories = categories.filter(c => c.status === 'Warning');
  const exceededCategories = categories.filter(c => c.status === 'Exceeded');

  const overallPercentUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0;
  let overallStatus = 'Healthy';
  if (overallPercentUsed >= 100) overallStatus = 'Critical';
  else if (overallPercentUsed >= 75) overallStatus = 'At Risk';

  return {
    month: monthStr,
    totalBudget,
    totalSpent,
    remaining: Math.max(totalBudget - totalSpent, 0),
    overallPercentUsed,
    overallStatus,
    categories,
    summary: {
      totalCategories: categories.length,
      safeCount: safeCategories.length,
      warningCount: warningCategories.length,
      exceededCount: exceededCategories.length,
    },
  };
}

async function generateInvestmentPerformanceReport(userId) {
  const investments = await Investment.find({ userId }).sort({ createdAt: -1 });

  const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
  const totalCurrentValue = investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0);
  const totalProfitLoss = totalCurrentValue - totalInvested;
  const overallROI = totalInvested > 0 ? Math.round((totalProfitLoss / totalInvested) * 10000) / 100 : 0;

  const performance = investments.map(inv => {
    const current = inv.currentValue || inv.amount || 0;
    const profit = current - (inv.amount || 0);
    const roi = inv.amount > 0 ? Math.round((profit / inv.amount) * 10000) / 100 : 0;
    return {
      _id: inv._id,
      name: inv.name,
      type: inv.type,
      category: inv.category,
      amount: inv.amount,
      currentValue: current,
      profitLoss: profit,
      roi,
      status: inv.status,
      investedDate: inv.investedDate,
      expectedReturns: inv.expectedReturns,
    };
  });

  const bestPerformer = performance.length > 0
    ? performance.reduce((best, curr) => curr.roi > best.roi ? curr : best, performance[0])
    : null;

  const worstPerformer = performance.length > 0
    ? performance.reduce((worst, curr) => curr.roi < worst.roi ? curr : worst, performance[0])
    : null;

  const typeAllocation = {};
  investments.forEach(inv => {
    if (!typeAllocation[inv.type]) typeAllocation[inv.type] = { type: inv.type, invested: 0, currentValue: 0, count: 0 };
    typeAllocation[inv.type].invested += inv.amount || 0;
    typeAllocation[inv.type].currentValue += inv.currentValue || inv.amount || 0;
    typeAllocation[inv.type].count += 1;
  });

  const categoryAllocation = {};
  investments.forEach(inv => {
    if (!categoryAllocation[inv.category]) categoryAllocation[inv.category] = { category: inv.category, invested: 0, currentValue: 0, count: 0 };
    categoryAllocation[inv.category].invested += inv.amount || 0;
    categoryAllocation[inv.category].currentValue += inv.currentValue || inv.amount || 0;
    categoryAllocation[inv.category].count += 1;
  });

  return {
    summary: {
      totalInvested,
      totalCurrentValue,
      totalProfitLoss,
      overallROI,
      totalInvestments: investments.length,
      activeInvestments: investments.filter(i => i.status === 'active').length,
    },
    performance,
    bestPerformer,
    worstPerformer,
    typeAllocation: Object.values(typeAllocation).sort((a, b) => b.currentValue - a.currentValue),
    categoryAllocation: Object.values(categoryAllocation).sort((a, b) => b.currentValue - a.currentValue),
  };
}

async function generateGoalProgressReport(userId) {
  const goals = await Goal.find({ userId }).sort({ createdAt: -1 });

  const now = new Date();
  goals.forEach(g => {
    if (g.status !== 'paused') {
      if (g.targetAmount > 0 && g.savedAmount >= g.targetAmount) {
        g.status = 'achieved';
      } else if (g.targetDate && new Date(g.targetDate) < now && g.savedAmount < g.targetAmount) {
        g.status = 'overdue';
      }
    }
  });

  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);

  const activeGoals = goals.filter(g => g.status === 'active');
  const achievedGoals = goals.filter(g => g.status === 'achieved');
  const overdueGoals = goals.filter(g => g.status === 'overdue');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  const goalDetails = goals.map(g => {
    const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
    const completionPercent = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 10000) / 100 : 0;
    let estimatedCompletion = null;
    if (g.monthlySaving > 0 && remaining > 0) {
      const monthsNeeded = Math.ceil(remaining / g.monthlySaving);
      estimatedCompletion = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1).toISOString().slice(0, 10);
    }

    return {
      _id: g._id,
      goalName: g.goalName,
      category: g.category,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      remaining,
      completionPercent,
      monthlySaving: g.monthlySaving,
      targetDate: g.targetDate,
      estimatedCompletion,
      priority: g.priority,
      status: g.status,
    };
  }).sort((a, b) => {
    const order = { overdue: 0, active: 1, paused: 2, achieved: 3 };
    return (order[a.status] || 4) - (order[b.status] || 4);
  });

  const categoryDistribution = {};
  goals.forEach(g => {
    if (!categoryDistribution[g.category]) categoryDistribution[g.category] = 0;
    categoryDistribution[g.category] += g.targetAmount || 0;
  });

  return {
    summary: {
      total: goals.length,
      active: activeGoals.length,
      achieved: achievedGoals.length,
      overdue: overdueGoals.length,
      paused: pausedGoals.length,
      totalTarget,
      totalSaved,
      overallCompletion: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 10000) / 100 : 0,
    },
    goals: goalDetails,
    categoryDistribution: Object.entries(categoryDistribution)
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value),
  };
}

function generateCSV(headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(row.map(escape).join(',')));
  return lines.join('\n');
}

function expenseReportCSV(report) {
  const headers = ['Date', 'Category', 'Amount', 'Description'];
  const rows = report.transactions.map(t => [
    new Date(t.date).toISOString().slice(0, 10),
    t.category,
    t.amount,
    t.description || '',
  ]);
  return generateCSV(headers, rows);
}

function budgetReportCSV(report) {
  const headers = ['Category', 'Budget Limit', 'Spent', 'Remaining', 'Utilization %', 'Status'];
  const rows = report.categories.map(c => [
    c.category,
    c.budgetLimit,
    c.spent,
    c.remaining,
    c.percentUsed,
    c.status,
  ]);
  return generateCSV(headers, rows);
}

function investmentReportCSV(report) {
  const headers = ['Name', 'Type', 'Category', 'Invested', 'Current Value', 'Profit/Loss', 'ROI %', 'Status'];
  const rows = report.performance.map(p => [
    p.name,
    p.type,
    p.category,
    p.amount,
    p.currentValue,
    p.profitLoss,
    p.roi,
    p.status,
  ]);
  return generateCSV(headers, rows);
}

function goalReportCSV(report) {
  const headers = ['Goal Name', 'Category', 'Target', 'Saved', 'Remaining', 'Completion %', 'Status', 'Priority'];
  const rows = report.goals.map(g => [
    g.goalName,
    g.category,
    g.targetAmount,
    g.savedAmount,
    g.remaining,
    g.completionPercent,
    g.status,
    g.priority,
  ]);
  return generateCSV(headers, rows);
}

module.exports = {
  generateMonthlyExpenseReport,
  generateBudgetUtilizationReport,
  generateInvestmentPerformanceReport,
  generateGoalProgressReport,
  expenseReportCSV,
  budgetReportCSV,
  investmentReportCSV,
  goalReportCSV,
};
