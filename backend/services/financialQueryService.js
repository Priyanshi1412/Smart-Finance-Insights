const { Expense, Budget, Investment, Goal, Income } = require('../models');
const { getMonthRange, formatMonthStr } = require('../utils/dateParser');

function fmtCurrency(val, currency = 'INR') {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$' };
  const sym = symbols[currency] || '₹';
  return `${sym}${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatPercent(val) {
  return `${Number(val || 0).toFixed(1)}%`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

async function fetchExpenseData(userId, dateInfo) {
  const query = { userId };
  if (dateInfo.start && dateInfo.end) {
    query.date = { $gte: dateInfo.start, $lte: dateInfo.end };
  }
  return Expense.find(query).sort({ date: 1 });
}

async function fetchIncomeData(userId, dateInfo) {
  const query = { userId };
  if (dateInfo.start && dateInfo.end) {
    query.date = { $gte: dateInfo.start, $lte: dateInfo.end };
  }
  return Income.find(query).sort({ date: 1 });
}

async function fetchBudgetData(userId, monthStr) {
  return Budget.find({ userId, month: monthStr });
}

async function fetchInvestmentData(userId) {
  return Investment.find({ userId }).sort({ createdAt: -1 });
}

async function fetchGoalData(userId) {
  return Goal.find({ userId }).sort({ createdAt: -1 });
}

function computeCategoryBreakdown(expenses) {
  const breakdown = {};
  expenses.forEach(e => {
    const cat = e.category || 'Other';
    breakdown[cat] = (breakdown[cat] || 0) + (e.amount || 0);
  });
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0,
    }));
}

function computeDailyBreakdown(expenses) {
  const daily = {};
  expenses.forEach(e => {
    const day = new Date(e.date).toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + (e.amount || 0);
  });
  return Object.entries(daily)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getPreviousMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  return `${prev.year}-${String(prev.month).padStart(2, '0')}`;
}

async function getExpenseSummary(userId, dateInfo, currency = 'INR') {
  const expenses = await fetchExpenseData(userId, dateInfo);
  const incomes = await fetchIncomeData(userId, dateInfo);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 10000) / 100 : 0;
  const categoryBreakdown = computeCategoryBreakdown(expenses);
  const dailyBreakdown = computeDailyBreakdown(expenses);

  return {
    expenses,
    incomes,
    totalExpenses,
    totalIncome,
    savings,
    savingsRate,
    categoryBreakdown,
    dailyBreakdown,
    transactionCount: expenses.length,
  };
}

async function getBudgetSummary(userId, monthStr, currency = 'INR') {
  const { start, end } = getMonthRange(monthStr);
  const [budgets, expenses] = await Promise.all([
    fetchBudgetData(userId, monthStr),
    Expense.find({ userId, date: { $gte: start, $lte: end } }),
  ]);

  const expenseByCategory = {};
  expenses.forEach(e => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + (e.amount || 0);
  });

  const categories = budgets.map(b => {
    const spent = expenseByCategory[b.category] || 0;
    const remaining = Math.max(b.limit - spent, 0);
    const percentUsed = b.limit > 0 ? Math.round((spent / b.limit) * 10000) / 100 : 0;
    let status = 'Safe';
    if (percentUsed >= 100) status = 'Exceeded';
    else if (percentUsed >= 75) status = 'Warning';
    return { category: b.category, budgetLimit: b.limit, spent, remaining, percentUsed, status };
  }).sort((a, b) => b.percentUsed - a.percentUsed);

  const totalBudget = budgets.reduce((s, b) => s + (b.limit || 0), 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);
  const overallPercentUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0;

  return { categories, totalBudget, totalSpent, overallPercentUsed, budgets };
}

async function getInvestmentSummary(userId, currency = 'INR') {
  const investments = await fetchInvestmentData(userId);
  const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
  const totalCurrentValue = investments.reduce((s, i) => s + (i.currentValue || i.amount || 0), 0);
  const totalProfitLoss = totalCurrentValue - totalInvested;
  const overallROI = totalInvested > 0 ? Math.round((totalProfitLoss / totalInvested) * 10000) / 100 : 0;

  const performance = investments.map(inv => {
    const current = inv.currentValue || inv.amount || 0;
    const profit = current - (inv.amount || 0);
    const roi = inv.amount > 0 ? Math.round((profit / inv.amount) * 10000) / 100 : 0;
    return { name: inv.name, type: inv.type, category: inv.category, amount: inv.amount, currentValue: current, profitLoss: profit, roi, status: inv.status };
  });

  const bestPerformer = performance.length > 0 ? performance.reduce((best, c) => c.roi > best.roi ? c : best) : null;
  const worstPerformer = performance.length > 0 ? performance.reduce((worst, c) => c.roi < worst.roi ? c : worst) : null;

  const typeAllocation = {};
  investments.forEach(inv => {
    if (!typeAllocation[inv.type]) typeAllocation[inv.type] = { type: inv.type, invested: 0, currentValue: 0, count: 0 };
    typeAllocation[inv.type].invested += inv.amount || 0;
    typeAllocation[inv.type].currentValue += inv.currentValue || inv.amount || 0;
    typeAllocation[inv.type].count += 1;
  });

  return { investments, totalInvested, totalCurrentValue, totalProfitLoss, overallROI, performance, bestPerformer, worstPerformer, typeAllocation: Object.values(typeAllocation) };
}

async function getGoalSummary(userId) {
  const goals = await fetchGoalData(userId);
  const now = new Date();

  const goalDetails = goals.map(g => {
    const remaining = Math.max((g.targetAmount || 0) - (g.savedAmount || 0), 0);
    const completionPercent = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 10000) / 100 : 0;
    let estimatedCompletion = null;
    if (g.monthlySaving > 0 && remaining > 0) {
      const monthsNeeded = Math.ceil(remaining / g.monthlySaving);
      estimatedCompletion = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1).toISOString().slice(0, 10);
    }
    return {
      goalName: g.goalName, category: g.category, targetAmount: g.targetAmount,
      savedAmount: g.savedAmount, remaining, completionPercent, monthlySaving: g.monthlySaving,
      targetDate: g.targetDate, estimatedCompletion, priority: g.priority, status: g.status,
    };
  });

  const activeGoals = goalDetails.filter(g => g.status === 'active');
  const achievedGoals = goalDetails.filter(g => g.status === 'achieved');
  const overdueGoals = goalDetails.filter(g => g.status === 'overdue');
  const totalTarget = goalDetails.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const totalSaved = goalDetails.reduce((s, g) => s + (g.savedAmount || 0), 0);

  return { goals: goalDetails, activeGoals, achievedGoals, overdueGoals, totalTarget, totalSaved, overallCompletion: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 10000) / 100 : 0 };
}

async function getFinancialHealthData(userId) {
  const [incomes, expenses, investments, goals, budgets] = await Promise.all([
    Income.find({ userId }),
    Expense.find({ userId }),
    Investment.find({ userId }),
    Goal.find({ userId }),
    Budget.find({ userId }),
  ]);

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
  const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
  const savings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100 * 10) / 10 : 0;
  const investmentGrowth = totalInvested > 0 ? Math.round(((totalCurrentValue - totalInvested) / totalInvested) * 100 * 10) / 10 : 0;
  const expenseRatio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100 * 10) / 10 : 0;

  const debtCategories = ['Rent', 'Bills & Utilities'];
  const totalDebt = expenses.filter(e => debtCategories.includes(e.category)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const debtToIncome = totalIncome > 0 ? Math.round((totalDebt / totalIncome) * 100 * 10) / 10 : 0;

  const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'overdue');
  const achievedGoals = goals.filter(g => g.status === 'achieved');
  const emergencyFund = goals.find(g => g.category === 'Emergency Fund');

  let score = 0;
  if (savingsRate >= 30) score += 30;
  else if (savingsRate >= 20) score += 25;
  else if (savingsRate >= 10) score += 15;
  else if (savingsRate > 0) score += 5;
  if (investmentGrowth > 10) score += 20;
  else if (investmentGrowth > 0) score += 15;
  else if (investmentGrowth === 0 && totalInvested === 0) score += 10;
  if (expenseRatio < 50) score += 20;
  else if (expenseRatio < 70) score += 15;
  else if (expenseRatio < 85) score += 8;
  if (debtToIncome < 15) score += 15;
  else if (debtToIncome < 30) score += 10;
  else if (debtToIncome < 40) score += 5;
  if (goals.length > 0) {
    const goalCompletion = achievedGoals.length / goals.length;
    if (goalCompletion >= 0.5) score += 15;
    else if (goalCompletion >= 0.25) score += 10;
    else score += 5;
  } else score += 5;
  score = Math.max(0, Math.min(100, score));

  let status;
  if (score >= 80) status = 'Excellent';
  else if (score >= 60) status = 'Good';
  else if (score >= 40) status = 'Fair';
  else status = 'Poor';

  return { score, status, savingsRate, investmentGrowth, expenseRatio, debtToIncome, totalIncome, totalExpenses, savings, totalInvested, totalCurrentValue, activeGoals: activeGoals.length, achievedGoals: achievedGoals.length, totalGoals: goals.length, emergencyFund };
}

module.exports = {
  getExpenseSummary,
  getBudgetSummary,
  getInvestmentSummary,
  getGoalSummary,
  getFinancialHealthData,
  fetchExpenseData,
  fetchIncomeData,
  fetchBudgetData,
  fetchInvestmentData,
  fetchGoalData,
  computeCategoryBreakdown,
  fmtCurrency,
  formatPercent,
  formatDate,
  formatMonthLabel,
  getPreviousMonth,
};
