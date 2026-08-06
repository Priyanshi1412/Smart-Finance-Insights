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

const getDashboardOverview = asyncHandler(async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1);
    const sixMonthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      sixMonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const [incomeAgg, expenseAgg, recentIncomes, recentExpenses, budgets, monthlyIncome, monthlyExpenses, expenseByCategory] = await Promise.all([
      Income.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Income.find({ userId }).sort({ date: -1 }).limit(5).lean(),
      Expense.find({ userId }).sort({ date: -1 }).limit(5).lean(),
      Budget.find({ userId }),
      Income.aggregate([
        { $match: { userId, date: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            total: { $sum: '$amount' }
          }
        }
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            total: { $sum: '$amount' }
          }
        }
      ]),
      Expense.aggregate([
        { $match: { userId } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 8 }
      ])
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpenses = expenseAgg[0]?.total || 0;
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
    const budgetPercentUsed = totalBudget > 0 ? Math.min((totalExpenses / totalBudget) * 100, 100) : 0;
    let budgetStatus = 'On Track';
    if (totalBudget > 0 && totalExpenses >= totalBudget) budgetStatus = 'Exceeded';
    else if (totalBudget > 0 && totalExpenses >= totalBudget * 0.8) budgetStatus = 'Near Limit';

    const curMonthIncome = monthlyIncome.find(m => m._id === currentMonthKey)?.total || 0;
    const curMonthExpenses = monthlyExpenses.find(m => m._id === currentMonthKey)?.total || 0;
    const prevMonthIncome = monthlyIncome.find(m => m._id === prevMonthKey)?.total || 0;
    const prevMonthExpenses = monthlyExpenses.find(m => m._id === prevMonthKey)?.total || 0;

    const incomeChange = prevMonthIncome > 0
      ? Math.round(((curMonthIncome - prevMonthIncome) / prevMonthIncome) * 100)
      : curMonthIncome > 0 ? 100 : 0;
    const expenseChange = prevMonthExpenses > 0
      ? Math.round(((curMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100)
      : curMonthExpenses > 0 ? 100 : 0;

    const incomeByMonth = {};
    const expenseByMonthMap = {};
    sixMonthKeys.forEach(k => { incomeByMonth[k] = 0; expenseByMonthMap[k] = 0; });
    monthlyIncome.forEach(m => { if (incomeByMonth[m._id] !== undefined) incomeByMonth[m._id] = m.total; });
    monthlyExpenses.forEach(m => { if (expenseByMonthMap[m._id] !== undefined) expenseByMonthMap[m._id] = m.total; });

    const sixMonthData = sixMonthKeys.map(k => {
      const [y, mo] = k.split('-');
      return {
        month: k,
        label: new Date(y, parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short' }),
        income: incomeByMonth[k],
        expenses: expenseByMonthMap[k],
      };
    });

    const categoryBreakdown = expenseByCategory.map(c => ({
      category: c._id,
      amount: c.total,
    }));

    const transactions = [
      ...recentIncomes.map(i => ({ ...i, type: 'income', name: i.source, category: 'Income' })),
      ...recentExpenses.map(e => ({ ...e, type: 'expense', name: e.category, category: e.category }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    const financialHealthScore = totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round((savings / totalIncome) * 100)))
      : 0;
    let financialHealthStatus = 'Poor';
    if (financialHealthScore >= 90) financialHealthStatus = 'Excellent';
    else if (financialHealthScore >= 70) financialHealthStatus = 'Good';
    else if (financialHealthScore >= 50) financialHealthStatus = 'Fair';

    res.json({
      summary: {
        totalIncome,
        totalExpenses,
        savings,
        savingsRate,
        financialHealthScore,
        financialHealthStatus,
        incomeChange,
        expenseChange,
        budget: { status: budgetStatus, percentUsed: budgetPercentUsed, limit: totalBudget },
      },
      sixMonthData,
      categoryBreakdown,
      transactions,
    });
  } catch (err) {
    console.error('Dashboard overview error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { getSummary, getRecentTransactions, getDashboardOverview };
