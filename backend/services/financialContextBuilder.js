const {
  getExpenseSummary,
  getBudgetSummary,
  getInvestmentSummary,
  getGoalSummary,
  getFinancialHealthData,
  getPreviousMonth,
  fmtCurrency,
  formatPercent,
  formatDate,
  formatMonthLabel,
} = require('./financialQueryService');
const { getMonthRange } = require('../utils/dateParser');
const { Expense, Income, Budget, Goal, Investment } = require('../models');

function fmt(val, currency = 'INR') {
  return fmtCurrency(val, currency);
}

async function buildFinancialContext(userId, dateInfo) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentDateInfo = {
    type: 'single_month',
    ...getMonthRange(currentMonth),
    label: 'this month',
    monthStr: currentMonth,
  };

  const targetDateInfo = dateInfo || currentDateInfo;
  const prevMonthStr = getPreviousMonth(targetDateInfo.monthStr || currentMonth);
  const prevDateInfo = {
    type: 'single_month',
    ...getMonthRange(prevMonthStr),
    label: formatMonthLabel(prevMonthStr),
    monthStr: prevMonthStr,
  };

  const [
    currentExpenses,
    prevExpenses,
    budgetData,
    investmentData,
    goalData,
    healthData,
  ] = await Promise.all([
    getExpenseSummary(userId, targetDateInfo, 'INR'),
    getExpenseSummary(userId, prevDateInfo, 'INR'),
    getBudgetSummary(userId, targetDateInfo.monthStr || currentMonth, 'INR'),
    getInvestmentSummary(userId, 'INR'),
    getGoalSummary(userId),
    getFinancialHealthData(userId),
  ]);

  const expenseChange = prevExpenses.totalExpenses > 0
    ? Math.round(((currentExpenses.totalExpenses - prevExpenses.totalExpenses) / prevExpenses.totalExpenses) * 10000) / 100
    : null;

  const savingsChange = prevExpenses.totalIncome > 0
    ? Math.round(((currentExpenses.savingsRate - prevExpenses.savingsRate) * 100)) / 100
    : null;

  const categoryChanges = [];
  if (prevExpenses.categoryBreakdown.length > 0) {
    currentExpenses.categoryBreakdown.forEach(cat => {
      const prevCat = prevExpenses.categoryBreakdown.find(pc => pc.category === cat.category);
      if (prevCat) {
        const change = prevCat.amount > 0
          ? Math.round(((cat.amount - prevCat.amount) / prevCat.amount) * 10000) / 100
          : null;
        if (change !== null && Math.abs(change) > 5) {
          categoryChanges.push({
            category: cat.category,
            currentAmount: cat.amount,
            previousAmount: prevCat.amount,
            change,
            direction: change > 0 ? 'increased' : 'decreased',
          });
        }
      }
    });
    categoryChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  const budgetAlerts = budgetData.categories
    .filter(c => c.status === 'Exceeded' || c.status === 'Warning')
    .map(c => ({
      category: c.category,
      status: c.status,
      percentUsed: c.percentUsed,
      spent: c.spent,
      limit: c.budgetLimit,
      remaining: c.remaining,
    }));

  const goalSummaries = goalData.goals.map(g => ({
    name: g.goalName,
    category: g.category,
    target: g.targetAmount,
    saved: g.savedAmount,
    remaining: g.remaining,
    completion: g.completionPercent,
    monthlySaving: g.monthlySaving,
    estimatedCompletion: g.estimatedCompletion,
    status: g.status,
    priority: g.priority,
  }));

  const activeGoals = goalSummaries.filter(g => g.status === 'active');
  const emergencyFund = goalSummaries.find(g => g.category === 'Emergency Fund');

  const investmentSummary = {
    totalInvested: investmentData.totalInvested,
    currentValue: investmentData.totalCurrentValue,
    profitLoss: investmentData.totalProfitLoss,
    roi: investmentData.overallROI,
    bestPerformer: investmentData.bestPerformer,
    worstPerformer: investmentData.worstPerformer,
    typeAllocation: investmentData.typeAllocation,
    topPerformers: investmentData.performance
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 3),
    underPerformers: investmentData.performance
      .filter(p => p.roi < 0)
      .sort((a, b) => a.roi - b.roi)
      .slice(0, 3),
  };

  const topSpendingCategories = currentExpenses.categoryBreakdown.slice(0, 5);
  const highestCategory = topSpendingCategories[0] || null;
  const lowestCategory = currentExpenses.categoryBreakdown.length > 0
    ? currentExpenses.categoryBreakdown[currentExpenses.categoryBreakdown.length - 1]
    : null;

  const monthlySavingsRate = currentExpenses.savingsRate;
  const expenseRatio = currentExpenses.totalIncome > 0
    ? Math.round((currentExpenses.totalExpenses / currentExpenses.totalIncome) * 10000) / 100
    : 0;

  let anomalies = [];
  if (expenseChange !== null && expenseChange > 25) {
    anomalies.push({
      type: 'spending_spike',
      message: `Expenses increased by ${Math.abs(expenseChange)}% compared to last month`,
      severity: expenseChange > 50 ? 'high' : 'medium',
    });
  }
  if (expenseChange !== null && expenseChange < -25) {
    anomalies.push({
      type: 'spending_drop',
      message: `Expenses decreased by ${Math.abs(expenseChange)}% compared to last month`,
      severity: 'low',
    });
  }
  budgetAlerts.forEach(alert => {
    if (alert.status === 'Exceeded') {
      anomalies.push({
        type: 'budget_exceeded',
        message: `${alert.category} budget exceeded by ${fmt(alert.spent - alert.limit)}`,
        severity: 'high',
        category: alert.category,
      });
    }
  });
  if (monthlySavingsRate < 10 && currentExpenses.totalIncome > 0) {
    anomalies.push({
      type: 'low_savings',
      message: `Savings rate is only ${formatPercent(monthlySavingsRate)}`,
      severity: 'high',
    });
  }
  if (investmentSummary.underPerformers.length > 0) {
    anomalies.push({
      type: 'underperforming_investments',
      message: `${investmentSummary.underPerformers.length} investment(s) showing losses`,
      severity: 'medium',
    });
  }
  activeGoals.forEach(g => {
    if (g.estimatedCompletion) {
      const estDate = new Date(g.estimatedCompletion);
      if (estDate < now && g.completion < 100) {
        anomalies.push({
          type: 'goal_overdue',
          message: `${g.name} goal is behind schedule`,
          severity: 'medium',
          goal: g.name,
        });
      }
    }
  });

  return {
    currentMonth: {
      label: targetDateInfo.label || formatMonthLabel(currentMonth),
      monthStr: targetDateInfo.monthStr || currentMonth,
      income: currentExpenses.totalIncome,
      expenses: currentExpenses.totalExpenses,
      savings: currentExpenses.savings,
      savingsRate: currentExpenses.savingsRate,
      expenseRatio,
      transactionCount: currentExpenses.transactionCount,
      categoryBreakdown: currentExpenses.categoryBreakdown,
      topSpendingCategories,
      highestCategory,
      lowestCategory,
    },
    previousMonth: {
      label: prevDateInfo.label,
      monthStr: prevMonthStr,
      income: prevExpenses.totalIncome,
      expenses: prevExpenses.totalExpenses,
      savings: prevExpenses.savings,
      savingsRate: prevExpenses.savingsRate,
    },
    changes: {
      expenseChange,
      savingsChange,
      categoryChanges,
    },
    budget: {
      totalBudget: budgetData.totalBudget,
      totalSpent: budgetData.totalSpent,
      overallPercentUsed: budgetData.overallPercentUsed,
      categories: budgetData.categories,
      alerts: budgetAlerts,
      exceededCount: budgetAlerts.filter(a => a.status === 'Exceeded').length,
      warningCount: budgetAlerts.filter(a => a.status === 'Warning').length,
    },
    investments: investmentSummary,
    goals: {
      all: goalSummaries,
      active: activeGoals,
      achieved: goalSummaries.filter(g => g.status === 'achieved'),
      overdue: goalSummaries.filter(g => g.status === 'overdue'),
      emergencyFund,
      totalTarget: goalData.totalTarget,
      totalSaved: goalData.totalSaved,
      overallCompletion: goalData.overallCompletion,
    },
    health: {
      score: healthData.score,
      status: healthData.status,
      savingsRate: healthData.savingsRate,
      investmentGrowth: healthData.investmentGrowth,
      expenseRatio: healthData.expenseRatio,
      debtToIncome: healthData.debtToIncome,
    },
    anomalies,
    insights: generateInsights(currentExpenses, prevExpenses, budgetData, investmentData, goalData, healthData),
  };
}

function generateInsights(currentExpenses, prevExpenses, budgetData, investmentData, goalData, healthData) {
  const insights = [];

  if (prevExpenses.totalExpenses > 0) {
    const change = Math.round(((currentExpenses.totalExpenses - prevExpenses.totalExpenses) / prevExpenses.totalExpenses) * 100);
    if (Math.abs(change) > 10) {
      insights.push({
        type: 'trend',
        area: 'spending',
        direction: change > 0 ? 'up' : 'down',
        magnitude: Math.abs(change),
        message: `Spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)}% vs last month`,
      });
    }
  }

  if (currentExpenses.savingsRate < 20 && currentExpenses.totalIncome > 0) {
    insights.push({
      type: 'warning',
      area: 'savings',
      message: `Savings rate (${formatPercent(currentExpenses.savingsRate)}) is below the recommended 20%`,
    });
  }

  budgetData.categories.forEach(cat => {
    if (cat.status === 'Exceeded') {
      insights.push({
        type: 'alert',
        area: 'budget',
        category: cat.category,
        message: `${cat.category} budget exceeded — spent ${formatPercent(cat.percentUsed)} of limit`,
      });
    } else if (cat.percentUsed >= 80) {
      insights.push({
        type: 'warning',
        area: 'budget',
        category: cat.category,
        message: `${cat.category} budget at ${formatPercent(cat.percentUsed)} — approaching limit`,
      });
    }
  });

  if (investmentData.overallROI > 0) {
    insights.push({
      type: 'positive',
      area: 'investments',
      message: `Portfolio is up ${formatPercent(investmentData.overallROI)} overall`,
    });
  } else if (investmentData.overallROI < 0) {
    insights.push({
      type: 'warning',
      area: 'investments',
      message: `Portfolio is down ${formatPercent(Math.abs(investmentData.overallROI))} overall`,
    });
  }

  if (goalData.activeGoals.length > 0) {
    const closestGoal = goalData.activeGoals
      .filter(g => g.completionPercent > 0)
      .sort((a, b) => b.completionPercent - a.completionPercent)[0];
    if (closestGoal && closestGoal.completionPercent > 75) {
      insights.push({
        type: 'positive',
        area: 'goals',
        message: `${closestGoal.goalName} is ${formatPercent(closestGoal.completionPercent)} complete — almost there!`,
      });
    }
  }

  if (healthData.savingsRate >= 30) {
    insights.push({
      type: 'positive',
      area: 'health',
      message: `Excellent savings rate of ${formatPercent(healthData.savingsRate)}`,
    });
  }

  return insights;
}

function buildConversationSummary(context) {
  const parts = [];
  parts.push(`Income: ${fmt(context.currentMonth.income)} | Expenses: ${fmt(context.currentMonth.expenses)} | Savings: ${fmt(context.currentMonth.savings)}`);
  parts.push(`Savings Rate: ${formatPercent(context.currentMonth.savingsRate)}`);
  if (context.budget.totalBudget > 0) {
    parts.push(`Budget: ${formatPercent(context.budget.overallPercentUsed)} used`);
  }
  if (context.investments.totalInvested > 0) {
    parts.push(`Investments: ${fmt(context.investments.totalInvested)} → ${fmt(context.investments.currentValue)} (${context.investments.roi >= 0 ? '+' : ''}${formatPercent(context.investments.roi)})`);
  }
  if (context.goals.active.length > 0) {
    parts.push(`Active Goals: ${context.goals.active.length}`);
  }
  parts.push(`Health Score: ${context.health.score}/100 (${context.health.status})`);
  return parts.join(' | ');
}

module.exports = {
  buildFinancialContext,
  buildConversationSummary,
  fmt,
  formatPercent,
};
