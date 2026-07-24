const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_finance';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const userSchema = new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    });

    const incomeSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      amount: { type: Number, required: true },
      source: { type: String, required: true },
      date: { type: Date, default: Date.now },
      description: { type: String }
    });

    const expenseSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      amount: { type: Number, required: true },
      category: { type: String, required: true },
      date: { type: Date, default: Date.now },
      description: { type: String }
    });

    const budgetSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      category: { type: String, required: true },
      limit: { type: Number, required: true },
      month: { type: String, required: true }
    });

    const goalSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      goalName: { type: String, required: true },
      category: { type: String, required: true },
      targetAmount: { type: Number, required: true },
      savedAmount: { type: Number, default: 0 },
      monthlySaving: { type: Number, default: 0 },
      targetDate: { type: Date, required: true },
      priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
      status: { type: String, enum: ['active', 'achieved', 'paused', 'overdue'], default: 'active' },
      contributions: [{ amount: Number, date: { type: Date, default: Date.now }, note: String }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const investmentSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      category: { type: String, required: true },
      amount: { type: Number, required: true },
      currentValue: { type: Number, default: 0 },
      investedDate: { type: Date, default: Date.now },
      expectedReturns: { type: Number, default: 0 },
      status: { type: String, default: 'active' },
      notes: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const User = mongoose.model('User', userSchema);
    const Income = mongoose.model('Income', incomeSchema);
    const Expense = mongoose.model('Expense', expenseSchema);
    const Budget = mongoose.model('Budget', budgetSchema);
    const Goal = mongoose.model('Goal', goalSchema);
    const Investment = mongoose.model('Investment', investmentSchema);

    function dateOnly(d) {
      const dt = new Date(d);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }

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

    app.post('/api/register', async (req, res) => {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
      try {
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashed });
        await user.save();
        res.status(201).json({ userId: user._id });
      } catch (err) {
        console.error(err);
        if (err.code === 11000) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
      try {
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, user: { name: user.name, email: user.email } });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    app.get('/api/dashboard/summary', auth, async (req, res) => {
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
        res.json({
          totalIncome,
          totalExpenses,
          savings,
          budget: { status, percentUsed, limit: totalBudget }
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/dashboard/recent-transactions', auth, async (req, res) => {
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

    app.post('/api/income', auth, async (req, res) => {
      const { amount, source, date, description } = req.body;
      if (!amount || !source) return res.status(400).json({ error: 'Missing fields' });
      try {
        const income = new Income({ userId: req.userId, amount, source, date, description });
        await income.save();
        res.status(201).json(income);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/income', auth, async (req, res) => {
      try {
        const incomes = await Income.find({ userId: req.userId }).sort({ date: -1 });
        res.json(incomes);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/income/:id', auth, async (req, res) => {
      const { amount, source, date, description } = req.body;
      if (!amount || !source) return res.status(400).json({ error: 'Missing fields' });
      try {
        const income = await Income.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { amount, source, date, description },
          { new: true }
        );
        res.json(income);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/income/:id', auth, async (req, res) => {
      try {
        await Income.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/expenses', auth, async (req, res) => {
      const { amount, category, date, description } = req.body;
      if (!amount || !category) return res.status(400).json({ error: 'Missing fields' });
      try {
        const expense = new Expense({ userId: req.userId, amount, category, date, description });
        await expense.save();
        res.status(201).json(expense);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/expenses', auth, async (req, res) => {
      try {
        const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
        res.json(expenses);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/expenses/:id', auth, async (req, res) => {
      const { amount, category, date, description } = req.body;
      if (!amount || !category) return res.status(400).json({ error: 'Missing fields' });
      try {
        const expense = await Expense.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { amount, category, date, description },
          { new: true }
        );
        res.json(expense);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/expenses/:id', auth, async (req, res) => {
      try {
        await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/budget', auth, async (req, res) => {
      const { category, limit, month } = req.body;
      if (!category || !limit || !month) return res.status(400).json({ error: 'Missing fields' });
      try {
        const budget = new Budget({ userId: req.userId, category, limit, month });
        await budget.save();
        res.status(201).json(budget);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/budget', auth, async (req, res) => {
      try {
        const budgets = await Budget.find({ userId: req.userId });
        res.json(budgets);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/goals', auth, async (req, res) => {
      const { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, priority } = req.body;
      console.log(`[GOALS POST] User ${req.userId} - Creating goal:`, { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, priority });
      if (!goalName || !category || !targetAmount || !targetDate) return res.status(400).json({ error: 'Missing fields' });
      try {
        const goal = new Goal({
          userId: req.userId, goalName, category, targetAmount,
          savedAmount: savedAmount || 0, monthlySaving: monthlySaving || 0, targetDate,
          priority: priority || 'medium'
        });
        applyGoalStatus(goal);
        await goal.save();
        console.log(`[GOALS POST] Created goal: ${goal._id} - status=${goal.status}, priority=${goal.priority}`);
        res.status(201).json(goal);
      } catch (err) {
        console.error('[GOALS POST] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/goals', auth, async (req, res) => {
      try {
        const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
        console.log(`[GOALS GET] User ${req.userId} - Found ${goals.length} goals`);
        let changed = false;
        for (const g of goals) {
          const prev = g.status;
          applyGoalStatus(g);
          if (g.status !== prev) {
            console.log(`[GOALS GET] Status changed for "${g.goalName}": ${prev} -> ${g.status}`);
            await g.save();
            changed = true;
          }
        }
        goals.forEach(g => console.log(`  - ${g.goalName}: status=${g.status}, priority=${g.priority}, saved=${g.savedAmount}/${g.targetAmount}, targetDate=${g.targetDate}`));
        res.json(goals);
      } catch (err) {
        console.error('[GOALS GET] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    const fmtAmount = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    app.get('/api/goals/analytics', auth, async (req, res) => {
      try {
        const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
        console.log(`[GOALS ANALYTICS] User ${req.userId} - Computing analytics for ${goals.length} goals`);

        for (const g of goals) {
          applyGoalStatus(g);
        }

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

        const timelineGoals = goals
          .filter(g => (g.status === 'active' || g.status === 'overdue') && g.targetDate)
          .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
          .slice(0, 6);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = [];
        for (let offset = 11; offset >= 0; offset--) {
          const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          const m = d.getMonth();
          const y = d.getFullYear();
          const label = `${months[m]}${y !== now.getFullYear() ? ' ' + y : ''}`;

          let monthActual = 0;
          let monthPlanned = 0;

          goals.forEach(g => {
            const contribs = (g.contributions || []).filter(c => {
              const cd = new Date(c.date);
              return cd.getMonth() === m && cd.getFullYear() === y;
            });
            monthActual += contribs.reduce((s, c) => s + c.amount, 0);

            if (g.status === 'active' || g.status === 'overdue') {
              const goalCreated = new Date(g.createdAt || 0);
              if (y > goalCreated.getFullYear() || (y === goalCreated.getFullYear() && m >= goalCreated.getMonth())) {
                monthPlanned += g.monthlySaving || 0;
              }
            }
          });

          monthlyData.push({ label, actual: monthActual, planned: monthPlanned });
        }

        const categoryMap = {};
        goals.forEach(g => {
          if (!categoryMap[g.category]) categoryMap[g.category] = 0;
          categoryMap[g.category] += g.targetAmount || 0;
        });
        const categoryDistribution = Object.entries(categoryMap)
          .map(([category, value]) => ({ category, value }))
          .sort((a, b) => b.value - a.value);

        const recommendations = [];
        if (goals.length === 0) {
          recommendations.push({ priority: 'good', text: 'Create your first financial goal to start planning your future.' });
        } else {
          overdueGoals.forEach(g => {
            const rem = Math.max(g.targetAmount - g.savedAmount, 0);
            recommendations.push({ priority: 'critical', text: `"${g.goalName}" is overdue! ${fmtAmount(rem)} still needed. Consider extending the deadline or increasing contributions.` });
          });

          activeGoals.forEach(g => {
            const pct = g.targetAmount > 0 ? (g.savedAmount / g.targetAmount) * 100 : 0;
            const rem = Math.max(g.targetAmount - g.savedAmount, 0);
            const monthsLeft = g.targetDate ? Math.max(1, Math.ceil((new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24 * 30))) : 12;
            const neededMonthly = rem / monthsLeft;

            if (pct < 30 && g.priority === 'high') {
              recommendations.push({ priority: 'critical', text: `"${g.goalName}" is high-priority with only ${Math.round(pct)}% progress. Save at least ${fmtAmount(neededMonthly)}/month to stay on track.` });
            } else if (g.monthlySaving > 0 && neededMonthly > g.monthlySaving * 1.5) {
              recommendations.push({ priority: 'moderate', text: `"${g.goalName}" needs ${fmtAmount(neededMonthly)}/month but you save ${fmtAmount(g.monthlySaving)}/month. Increase by ${fmtAmount(neededMonthly - g.monthlySaving)} or extend the deadline.` });
            } else if (pct >= 100) {
              recommendations.push({ priority: 'good', text: `"${g.goalName}" is complete! Redirect ${fmtAmount(g.monthlySaving)}/month to other active goals.` });
            }
          });

          const emergency = activeGoals.find(g => g.category === 'Emergency Fund');
          if (emergency && emergency.savedAmount < emergency.targetAmount * 0.5) {
            recommendations.push({ priority: 'critical', text: 'Emergency Fund should be your highest priority. Aim for 3-6 months of expenses.' });
          }
          if (activeGoals.length + overdueGoals.length > 3) {
            recommendations.push({ priority: 'moderate', text: `You have ${activeGoals.length + overdueGoals.length} goals needing attention. Focus on 2-3 high-priority goals to avoid spreading savings too thin.` });
          }
        }

        const achievements = [];
        const totalContribs = goals.reduce((s, g) => s + (g.contributions || []).length, 0);
        achievements.push({ icon: '🎯', title: 'First Goal', desc: 'Created your first goal', unlocked: goals.length > 0 });
        achievements.push({ icon: '💰', title: `Saved ${fmtAmount(50000)}`, desc: `Accumulated ${fmtAmount(50000)}`, unlocked: totalSaved >= 50000 });
        achievements.push({ icon: '🏆', title: 'First Achievement', desc: 'Completed first goal', unlocked: achievedGoals.length >= 1 });
        achievements.push({ icon: '📊', title: '10 Contributions', desc: 'Made 10 contributions', unlocked: totalContribs >= 10 });
        achievements.push({ icon: '👑', title: 'Goal Master', desc: 'Completed 3+ goals', unlocked: achievedGoals.length >= 3 });
        achievements.push({ icon: '💎', title: `Saved ${fmtAmount(100000)}`, desc: `Accumulated ${fmtAmount(100000)}`, unlocked: totalSaved >= 100000 });

        console.log(`[GOALS ANALYTICS] Summary: total=${goals.length}, active=${activeGoals.length}, achieved=${achievedGoals.length}, overdue=${overdueGoals.length}, upcomingDeadlines=${upcomingDeadlines.length}`);

        res.json({
          summary: {
            total: goals.length,
            active: activeGoals.length,
            achieved: achievedGoals.length,
            overdue: overdueGoals.length,
            paused: pausedGoals.length,
            totalTarget,
            totalSaved,
            remaining,
            completionPct,
            upcomingDeadlines: upcomingDeadlines.length,
          },
          upcomingDeadlines,
          timelineGoals,
          monthlyData,
          categoryDistribution,
          recommendations: recommendations.slice(0, 5),
          achievements,
          goals,
        });
      } catch (err) {
        console.error('[GOALS ANALYTICS] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/goals/:id', auth, async (req, res) => {
      const { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, priority } = req.body;
      console.log(`[GOALS PUT] User ${req.userId} - Updating goal ${req.params.id}:`, { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, priority });
      try {
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        goal.goalName = goalName;
        goal.category = category;
        goal.targetAmount = targetAmount;
        goal.savedAmount = savedAmount;
        goal.monthlySaving = monthlySaving;
        goal.targetDate = targetDate;
        goal.priority = priority;
        goal.updatedAt = Date.now();

        applyGoalStatus(goal);
        await goal.save();

        console.log(`[GOALS PUT] Updated goal: ${goal.goalName} - status=${goal.status}, priority=${goal.priority}, saved=${goal.savedAmount}/${goal.targetAmount}`);
        res.json(goal);
      } catch (err) {
        console.error('[GOALS PUT] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/goals/:id', auth, async (req, res) => {
      try {
        const deleted = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        console.log(`[GOALS DELETE] User ${req.userId} - Deleted goal: ${deleted ? deleted.goalName : 'not found'} (${req.params.id})`);
        res.json({ success: true });
      } catch (err) {
        console.error('[GOALS DELETE] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/goals/:id/contributions', auth, async (req, res) => {
      const { amount, date, note } = req.body;
      const numAmount = Number(amount);
      console.log(`[GOALS CONTRIB] User ${req.userId} - Adding contribution to goal ${req.params.id}:`, { amount: numAmount, date, note });
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
        console.log(`[GOALS CONTRIB] Updated goal: ${goal.goalName} - saved=${goal.savedAmount}/${goal.targetAmount}, status=${goal.status}`);
        res.json(goal);
      } catch (err) {
        console.error('[GOALS CONTRIB] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/investments', auth, async (req, res) => {
      const { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes } = req.body;
      if (!name || !type || !category || !amount) return res.status(400).json({ error: 'Missing fields' });
      try {
        const investment = new Investment({
          userId: req.userId, name, type, category, amount,
          currentValue: currentValue != null ? currentValue : amount,
          investedDate: investedDate || Date.now(),
          expectedReturns: expectedReturns || 0,
          status: status || 'active',
          notes: notes || ''
        });
        await investment.save();
        res.status(201).json(investment);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/investments', auth, async (req, res) => {
      try {
        const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(investments);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/investments/:id', auth, async (req, res) => {
      const { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes } = req.body;
      try {
        const investment = await Investment.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes, updatedAt: Date.now() },
          { new: true }
        );
        if (!investment) return res.status(404).json({ error: 'Investment not found' });
        res.json(investment);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/investments/:id', auth, async (req, res) => {
      try {
        await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/investments/analytics', auth, async (req, res) => {
      try {
        const investments = await Investment.find({ userId: req.userId });
        const active = investments.filter(inv => inv.status === 'active');
        const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
        const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
        const totalReturns = totalCurrentValue - totalInvested;
        const returnPct = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;

        const categoryBreakdown = {};
        investments.forEach(inv => {
          if (!categoryBreakdown[inv.category]) {
            categoryBreakdown[inv.category] = { category: inv.category, invested: 0, currentValue: 0, count: 0 };
          }
          categoryBreakdown[inv.category].invested += inv.amount || 0;
          categoryBreakdown[inv.category].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
          categoryBreakdown[inv.category].count += 1;
        });

        const typeBreakdown = {};
        investments.forEach(inv => {
          if (!typeBreakdown[inv.type]) {
            typeBreakdown[inv.type] = { type: inv.type, invested: 0, currentValue: 0, count: 0 };
          }
          typeBreakdown[inv.type].invested += inv.amount || 0;
          typeBreakdown[inv.type].currentValue += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
          typeBreakdown[inv.type].count += 1;
        });

        const performance = investments.map(inv => {
          const curr = inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
          const profit = curr - (inv.amount || 0);
          const retPct = inv.amount > 0 ? ((profit / inv.amount) * 100) : 0;
          return {
            _id: inv._id,
            name: inv.name,
            type: inv.type,
            category: inv.category,
            amount: inv.amount,
            currentValue: curr,
            profit,
            returnPct: Math.round(retPct * 100) / 100,
            status: inv.status,
            investedDate: inv.investedDate,
          };
        }).sort((a, b) => b.returnPct - a.returnPct);

        const bestPerformer = performance[0] || null;
        const worstPerformer = performance.length > 0 ? performance[performance.length - 1] : null;

        const typeBreakdownArr = Object.values(typeBreakdown);
        const categoryBreakdownArr = Object.values(categoryBreakdown);
        const numTypes = typeBreakdownArr.length;
        const numCategories = categoryBreakdownArr.length;
        const maxTypeAllocation = totalCurrentValue > 0
          ? Math.max(...typeBreakdownArr.map(t => (t.currentValue / totalCurrentValue) * 100))
          : 0;
        const concentrationRatio = Math.round(maxTypeAllocation * 100) / 100;
        const diversificationScore = numTypes === 0 ? 0
          : Math.min(100, Math.round(
              (Math.min(numTypes, 6) / 6) * 60
              + (numCategories >= 3 ? 20 : numCategories * 6.67)
              + (concentrationRatio < 40 ? 20 : concentrationRatio < 60 ? 10 : 0)
            ));
        const diversificationLabel = diversificationScore >= 70 ? 'Well Diversified'
          : diversificationScore >= 40 ? 'Moderately Diversified' : 'Concentrated';

        res.json({
          summary: {
            totalInvested,
            totalCurrentValue,
            totalReturns,
            returnPct: Math.round(returnPct * 100) / 100,
            activeCount: active.length,
            totalCount: investments.length,
          },
          categoryBreakdown: categoryBreakdownArr.sort((a, b) => b.currentValue - a.currentValue),
          typeBreakdown: typeBreakdownArr.sort((a, b) => b.currentValue - a.currentValue),
          performance,
          bestPerformer,
          worstPerformer,
          diversification: {
            score: diversificationScore,
            label: diversificationLabel,
            numTypes,
            numCategories,
            concentrationRatio,
          },
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/portfolio/analytics', auth, async (req, res) => {
      try {
        const investments = await Investment.find({ userId: req.userId });
        const goals = await Goal.find({ userId: req.userId });

        const totalInvested = investments.reduce((s, inv) => s + (inv.amount || 0), 0);
        const totalCurrentValue = investments.reduce((s, inv) => s + (inv.currentValue != null ? inv.currentValue : (inv.amount || 0)), 0);
        const totalReturns = totalCurrentValue - totalInvested;
        const overallROI = totalInvested > 0 ? ((totalReturns / totalInvested) * 100) : 0;

        const performance = investments.map(inv => {
          const curr = inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
          const profit = curr - (inv.amount || 0);
          const retPct = inv.amount > 0 ? ((profit / inv.amount) * 100) : 0;
          return {
            name: inv.name, type: inv.type, category: inv.category,
            amount: inv.amount, currentValue: curr, profit,
            returnPct: Math.round(retPct * 100) / 100,
            investedDate: inv.investedDate, status: inv.status,
          };
        }).sort((a, b) => b.returnPct - a.returnPct);

        const topPerformers = performance.filter(p => p.profit > 0).slice(0, 5);
        const lowestPerformers = [...performance].filter(p => p.profit < 0).sort((a, b) => a.returnPct - b.returnPct).slice(0, 5);

        const typeAllocation = {};
        investments.forEach(inv => {
          if (!typeAllocation[inv.type]) typeAllocation[inv.type] = 0;
          typeAllocation[inv.type] += inv.currentValue != null ? inv.currentValue : (inv.amount || 0);
        });
        const typeAllocationArr = Object.entries(typeAllocation)
          .map(([type, value]) => ({ type, value, pct: totalCurrentValue > 0 ? Math.round((value / totalCurrentValue) * 10000) / 100 : 0 }))
          .sort((a, b) => b.value - a.value);

        const totalGoalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
        const totalGoalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
        const goalsAchieved = goals.filter(g => g.targetAmount > 0 && (g.savedAmount / g.targetAmount) * 100 >= 100).length;
        const goalCompletionPct = goals.length > 0 ? Math.round((goalsAchieved / goals.length) * 100) : 0;
        const remainingSavings = Math.max(totalGoalTarget - totalGoalSaved, 0);

        const goalProgress = goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100) : 0;
          return { name: g.goalName, category: g.category, target: g.targetAmount, saved: g.savedAmount, pct };
        }).sort((a, b) => b.pct - a.pct);

        const numTypes = typeAllocationArr.length;
        const maxAlloc = typeAllocationArr.length > 0 ? typeAllocationArr[0].pct : 0;
        const riskScore = numTypes === 0 ? 0 : Math.round(
          100 - (numTypes <= 2 ? 30 : numTypes <= 4 ? 15 : 5) - (maxAlloc > 70 ? 30 : maxAlloc > 50 ? 15 : 0) - (overallROI < 0 ? 20 : 0)
        );

        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }));
        }
        const monthlyGrowth = months.map((m, idx) => ({
          month: m,
          invested: totalInvested * ((idx + 1) / months.length),
          value: totalCurrentValue * ((idx + 1) / months.length),
        }));

        res.json({
          investments: {
            totalInvested,
            totalCurrentValue,
            totalReturns,
            overallROI: Math.round(overallROI * 100) / 100,
            count: investments.length,
            activeCount: investments.filter(i => i.status === 'active').length,
          },
          topPerformers,
          lowestPerformers,
          typeAllocation: typeAllocationArr,
          goals: {
            totalTarget: totalGoalTarget,
            totalSaved: totalGoalSaved,
            totalGoals: goals.length,
            goalsAchieved,
            goalCompletionPct,
            remainingSavings,
            progress: goalProgress,
          },
          risk: {
            score: Math.max(0, Math.min(100, riskScore)),
            label: riskScore >= 70 ? 'Low Risk' : riskScore >= 40 ? 'Moderate Risk' : 'High Risk',
            numTypes,
            maxAllocation: maxAlloc,
          },
          monthlyGrowth,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/clear-data', auth, async (req, res) => {
      try {
        console.log(`[CLEAR DATA] User ${req.userId} clearing their data`);
        const results = await Promise.all([
          Income.deleteMany({ userId: req.userId }),
          Expense.deleteMany({ userId: req.userId }),
          Budget.deleteMany({ userId: req.userId }),
          Goal.deleteMany({ userId: req.userId }),
          Investment.deleteMany({ userId: req.userId }),
        ]);
        const total = results.reduce((s, r) => s + r.deletedCount, 0);
        console.log(`[CLEAR DATA] Deleted ${total} records for user ${req.userId}`);
        res.json({ success: true, deletedCount: total });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.warn('WARNING: MongoDB is not configured. Database features will be disabled until configured.');
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`Backend listening on port ${port} (database not connected)`);
    });
  }
}

startServer();
