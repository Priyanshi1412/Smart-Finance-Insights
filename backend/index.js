const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();
const mlService = require('./services/mlService');
const jarvisRoutes = require('./routes/jarvisRoutes');
const exportRoutes = require('./routes/export');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Security headers
app.use(helmet());

// Body parser with size limit
app.use(express.json({ limit: '10kb' }));

// CORS - restrict to frontend origin in production
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Sanitize MongoDB queries to prevent NoSQL injection
app.use(mongoSanitize());

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);

// Validate JWT secret
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_finance';
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using a persistent dev secret. Set a strong JWT_SECRET in production!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-smartfinance-persistent-key-2024';

// Input validation helpers
const { ObjectId } = mongoose.Types;
function isValidObjectId(id) {
  return ObjectId.isValid(id);
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateAmount(amount) {
  const num = Number(amount);
  return !isNaN(num) && isFinite(num) && num >= 0 && num < 1e12;
}

const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_GOAL_STATUSES = ['active', 'achieved', 'paused', 'overdue'];
const VALID_INVESTMENT_STATUSES = ['active', 'closed', 'paused'];
const VALID_INVESTMENT_TYPES = ['Stocks', 'Mutual Funds', 'Fixed Deposit', 'PPF', 'NPS', 'Crypto', 'Gold', 'Real Estate', 'Bonds', 'ETF'];

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

// ObjectID param validation middleware
app.param('id', (req, res, next, value) => {
  if (!isValidObjectId(value)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
});

const MONGOOSE_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  retryWrites: true,
};

async function connectWithRetry(retries = 3, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI, MONGOOSE_OPTIONS);
      console.log('Connected to MongoDB');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  return false;
}

async function startServer() {
  try {
    const connected = await connectWithRetry();
    if (!connected) {
      throw new Error('Failed to connect to MongoDB after retries');
    }

    const { User, Income, Expense, Budget, Goal, Investment, Notification } = require('./models');

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
      if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

      const sanitizedName = sanitizeString(name, 100);
      const sanitizedEmail = sanitizeString(email, 254).toLowerCase();

      if (!sanitizedName || sanitizedName.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
      if (!validateEmail(sanitizedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (password.length > 128) {
        return res.status(400).json({ error: 'Password is too long' });
      }

      try {
        const hashed = await bcrypt.hash(password, 12);
        const user = new User({ name: sanitizedName, email: sanitizedEmail, password: hashed });
        await user.save();
        res.status(201).json({ userId: user._id });
      } catch (err) {
        if (err.code === 11000) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        console.error('[REGISTER] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'All fields are required' });

      const sanitizedEmail = sanitizeString(email, 254).toLowerCase();

      try {
        const user = await User.findOne({ email: sanitizedEmail });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        user.lastLoginAt = new Date();
        await user.save();
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '2h' });
        res.json({
          token,
          user: {
            name: user.name,
            email: user.email,
            profilePicture: user.profilePicture || '',
            currency: user.currency || 'INR',
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            passwordChangedAt: user.passwordChangedAt,
          }
        });
      } catch (err) {
        console.error('[LOGIN] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
      if (!amount || !source) return res.status(400).json({ error: 'Amount and source are required' });
      if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
      try {
        const income = new Income({
          userId: req.userId,
          amount: Number(amount),
          source: sanitizeString(source, 100),
          date: date ? new Date(date) : new Date(),
          description: sanitizeString(description || '', 500),
        });
        await income.save();
        res.status(201).json(income);
      } catch (err) {
        console.error('[INCOME POST] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/income', auth, async (req, res) => {
      try {
        const incomes = await Income.find({ userId: req.userId }).sort({ date: -1 });
        res.json(incomes);
      } catch (err) {
        console.error('[INCOME GET] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/income/:id', auth, async (req, res) => {
      const { amount, source, date, description } = req.body;
      if (!amount || !source) return res.status(400).json({ error: 'Amount and source are required' });
      if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
      try {
        const income = await Income.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          {
            amount: Number(amount),
            source: sanitizeString(source, 100),
            date: date ? new Date(date) : undefined,
            description: sanitizeString(description || '', 500),
          },
          { new: true }
        );
        if (!income) return res.status(404).json({ error: 'Income not found' });
        res.json(income);
      } catch (err) {
        console.error('[INCOME PUT] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/income/:id', auth, async (req, res) => {
      try {
        const deleted = await Income.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: 'Income not found' });
        res.json({ success: true });
      } catch (err) {
        console.error('[INCOME DELETE] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/expenses', auth, async (req, res) => {
      const { amount, category, date, description } = req.body;
      if (!amount || !category) return res.status(400).json({ error: 'Amount and category are required' });
      if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
      try {
        const expense = new Expense({
          userId: req.userId,
          amount: Number(amount),
          category: sanitizeString(category, 50),
          date: date ? new Date(date) : new Date(),
          description: sanitizeString(description || '', 500),
        });
        await expense.save();
        res.status(201).json(expense);
      } catch (err) {
        console.error('[EXPENSE POST] Error:', err.message);
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
      if (!amount || !category) return res.status(400).json({ error: 'Amount and category are required' });
      if (!validateAmount(amount)) return res.status(400).json({ error: 'Invalid amount' });
      try {
        const expense = await Expense.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          {
            amount: Number(amount),
            category: sanitizeString(category, 50),
            date: date ? new Date(date) : undefined,
            description: sanitizeString(description || '', 500),
          },
          { new: true }
        );
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        res.json(expense);
      } catch (err) {
        console.error('[EXPENSE PUT] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/expenses/:id', auth, async (req, res) => {
      try {
        const deleted = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: 'Expense not found' });
        res.json({ success: true });
      } catch (err) {
        console.error('[EXPENSE DELETE] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/budget', auth, async (req, res) => {
      const { category, limit, month } = req.body;
      if (!category || !limit || !month) return res.status(400).json({ error: 'Category, limit, and month are required' });
      if (!validateAmount(limit) || Number(limit) <= 0) return res.status(400).json({ error: 'Invalid budget limit' });
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
      try {
        const budget = new Budget({
          userId: req.userId,
          category: sanitizeString(category, 50),
          limit: Number(limit),
          month,
        });
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
      const { goalName, category, targetAmount, monthlySaving, targetDate, priority } = req.body;
      if (!goalName || !category || !targetAmount || !targetDate) {
        return res.status(400).json({ error: 'Goal name, category, target amount, and target date are required' });
      }
      if (!validateAmount(targetAmount) || Number(targetAmount) <= 0) {
        return res.status(400).json({ error: 'Target amount must be a positive number' });
      }
      if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ error: 'Priority must be high, medium, or low' });
      }
      try {
        const goal = new Goal({
          userId: req.userId,
          goalName: sanitizeString(goalName, 100),
          category: sanitizeString(category, 50),
          targetAmount: Number(targetAmount),
          savedAmount: 0,
          monthlySaving: monthlySaving ? Number(monthlySaving) : 0,
          targetDate: new Date(targetDate),
          priority: priority || 'medium',
        });
        applyGoalStatus(goal);
        await goal.save();
        res.status(201).json(goal);
      } catch (err) {
        console.error('[GOALS POST] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/goals', auth, async (req, res) => {
      try {
        const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
        const bulkOps = [];
        for (const g of goals) {
          const prev = g.status;
          applyGoalStatus(g);
          if (g.status !== prev) {
            bulkOps.push({
              updateOne: { filter: { _id: g._id }, update: { $set: { status: g.status, updatedAt: new Date() } } }
            });
          }
        }
        if (bulkOps.length > 0) {
          await Goal.bulkWrite(bulkOps, { ordered: false });
        }
        res.json(goals);
      } catch (err) {
        console.error('[GOALS GET] Error:', err.message);
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
      const { goalName, category, targetAmount, monthlySaving, targetDate, priority } = req.body;
      try {
        const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
        if (!goal) return res.status(404).json({ error: 'Goal not found' });

        if (goalName !== undefined) goal.goalName = sanitizeString(goalName, 100);
        if (category !== undefined) goal.category = sanitizeString(category, 50);
        if (targetAmount !== undefined) {
          if (!validateAmount(targetAmount) || Number(targetAmount) <= 0) {
            return res.status(400).json({ error: 'Target amount must be a positive number' });
          }
          goal.targetAmount = Number(targetAmount);
        }
        if (monthlySaving !== undefined) goal.monthlySaving = Number(monthlySaving) || 0;
        if (targetDate !== undefined) goal.targetDate = new Date(targetDate);
        if (priority !== undefined) {
          if (!VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({ error: 'Priority must be high, medium, or low' });
          }
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

    app.delete('/api/goals/:id', auth, async (req, res) => {
      try {
        const deleted = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: 'Goal not found' });
        res.json({ success: true });
      } catch (err) {
        console.error('[GOALS DELETE] Error:', err.message);
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
      if (!name || !type || !category || !amount) return res.status(400).json({ error: 'Name, type, category, and amount are required' });
      if (!validateAmount(amount) || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
      if (status && !VALID_INVESTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status must be active, closed, or paused' });
      }
      try {
        const investment = new Investment({
          userId: req.userId,
          name: sanitizeString(name, 100),
          type: sanitizeString(type, 50),
          category: sanitizeString(category, 50),
          amount: Number(amount),
          currentValue: currentValue != null ? Number(currentValue) : Number(amount),
          investedDate: investedDate ? new Date(investedDate) : new Date(),
          expectedReturns: expectedReturns ? Number(expectedReturns) : 0,
          status: status || 'active',
          notes: sanitizeString(notes || '', 500),
        });
        await investment.save();
        res.status(201).json(investment);
      } catch (err) {
        console.error('[INVESTMENT POST] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/investments', auth, async (req, res) => {
      try {
        const investments = await Investment.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(investments);
      } catch (err) {
        console.error('[INVESTMENT GET] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/investments/:id', auth, async (req, res) => {
      const { name, type, category, amount, currentValue, investedDate, expectedReturns, status, notes } = req.body;
      if (amount !== undefined && (!validateAmount(amount) || Number(amount) <= 0)) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      if (status && !VALID_INVESTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status must be active, closed, or paused' });
      }
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

        const investment = await Investment.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          updateFields,
          { new: true }
        );
        if (!investment) return res.status(404).json({ error: 'Investment not found' });
        res.json(investment);
      } catch (err) {
        console.error('[INVESTMENT PUT] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/investments/:id', auth, async (req, res) => {
      try {
        const deleted = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: 'Investment not found' });
        res.json({ success: true });
      } catch (err) {
        console.error('[INVESTMENT DELETE] Error:', err.message);
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

    app.get('/api/analytics/spending-patterns', auth, async (req, res) => {
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
        Object.values(categoryTotals).forEach(c => {
          c.avgPerTransaction = c.count > 0 ? Math.round(c.total / c.count) : 0;
        });
        const categorySummary = Object.values(categoryTotals).sort((a, b) => b.total - a.total);
        const totalExpensesAll = categorySummary.reduce((s, c) => s + c.total, 0);
        categorySummary.forEach(c => {
          c.percentage = totalExpensesAll > 0 ? Math.round((c.total / totalExpensesAll) * 10000) / 100 : 0;
        });

        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(d.toISOString().slice(0, 7));
        }
        const monthlySpending = {};
        months.forEach(m => { monthlySpending[m] = { month: m, total: 0, categories: {} }; });
        expenses.forEach(e => {
          const m = new Date(e.date).toISOString().slice(0, 7);
          if (monthlySpending[m]) {
            monthlySpending[m].total += Number(e.amount || 0);
            const cat = e.category || 'Other';
            monthlySpending[m].categories[cat] = (monthlySpending[m].categories[cat] || 0) + Number(e.amount || 0);
          }
        });
        const monthlyTrend = months.map(m => ({
          ...monthlySpending[m],
          label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }),
        }));

        const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalExpensesVal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        let highestCategory = categorySummary[0] || null;
        let spendingHabits = [];
        if (highestCategory && highestCategory.percentage > 35) {
          spendingHabits.push({ type: 'warning', text: `${highestCategory.category} accounts for ${highestCategory.percentage}% of your total spending. Consider reducing expenses in this category.` });
        }
        if (totalIncome > 0 && (totalExpensesVal / totalIncome) > 0.8) {
          spendingHabits.push({ type: 'critical', text: `You're spending ${Math.round((totalExpensesVal / totalIncome) * 100)}% of your income. Try to keep expenses below 70-80% of income.` });
        }
        const avgMonthlySpend = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.total, 0) / monthlyTrend.length : 0;
        if (monthlyTrend.length >= 2) {
          const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.total || 0;
          const prevMonth = monthlyTrend[monthlyTrend.length - 2]?.total || 0;
          if (prevMonth > 0 && lastMonth > prevMonth * 1.2) {
            spendingHabits.push({ type: 'warning', text: `Spending increased by ${Math.round(((lastMonth - prevMonth) / prevMonth) * 100)}% last month. Monitor your expenses closely.` });
          }
        }

        res.json({
          categorySummary,
          monthlyTrend,
          totalExpenses: totalExpensesAll,
          totalIncome,
          avgMonthlySpend: Math.round(avgMonthlySpend),
          highestCategory,
          spendingHabits,
          transactionCount: expenses.length,
        });
      } catch (err) {
        console.error('[SPENDING PATTERNS] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/analytics/budget-recommendations', auth, async (req, res) => {
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

        // Aggregate expenses by category and month
        const categoryTotals = {};
        expenses.forEach(e => {
          const cat = e.category || 'Other';
          if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0, monthly: {} };
          categoryTotals[cat].total += Number(e.amount || 0);
          categoryTotals[cat].count += 1;
          const m = new Date(e.date).toISOString().slice(0, 7);
          categoryTotals[cat].monthly[m] = (categoryTotals[cat].monthly[m] || 0) + Number(e.amount || 0);
        });

        // Current and previous month expenses
        const curMonthExpenses = expenses.filter(e => new Date(e.date).toISOString().slice(0, 7) === currentMonth);
        const prevMonthExpenses = expenses.filter(e => new Date(e.date).toISOString().slice(0, 7) === prevMonth);
        const totalCurMonth = curMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const totalPrevMonth = prevMonthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        // Current and previous month income
        const curMonthIncome = incomes.filter(i => new Date(i.date).toISOString().slice(0, 7) === currentMonth)
          .reduce((s, i) => s + Number(i.amount || 0), 0);
        const prevMonthIncome = incomes.filter(i => new Date(i.date).toISOString().slice(0, 7) === prevMonth)
          .reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        // Budget data
        const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
        const budgetByCategory = {};
        currentMonthBudgets.forEach(b => { budgetByCategory[b.category] = b.limit; });

        const recommendations = [];
        const overspendingAlerts = [];
        let recId = 0;

        const addRec = (type, priority, category, title, message, data = {}) => {
          recommendations.push({ id: recId++, type, priority, category, title, message, ...data });
        };

        // --- 1. CATEGORY BUDGET ANALYSIS ---
        const curMonthCatTotals = {};
        curMonthExpenses.forEach(e => {
          const cat = e.category || 'Other';
          curMonthCatTotals[cat] = (curMonthCatTotals[cat] || 0) + Number(e.amount || 0);
        });

        Object.entries(categoryTotals).forEach(([cat, data]) => {
          const monthlyAmounts = Object.entries(data.monthly)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 3)
            .map(([, v]) => v);
          const avgMonthly = monthlyAmounts.length > 0 ? monthlyAmounts.reduce((s, v) => s + v, 0) / monthlyAmounts.length : 0;
          const currentBudget = budgetByCategory[cat];
          const curSpent = curMonthCatTotals[cat] || 0;

          if (currentBudget) {
            const pct = currentBudget > 0 ? (curSpent / currentBudget) * 100 : 0;
            if (pct >= 100) {
              const overBy = Math.round(curSpent - currentBudget);
              const suggestedCut = Math.round(overBy * 1.1);
              overspendingAlerts.push({
                category: cat, spent: curSpent, limit: currentBudget,
                overBy, percentage: Math.round(pct),
              });
              addRec('reduce', 'high', cat,
                `Reduce ${cat} spending`,
                `You exceeded your ${cat} budget by ${fmtAmount(overBy)} this month (${fmtAmount(curSpent)} of ${fmtAmount(currentBudget)}). Cut spending by at least ${fmtAmount(suggestedCut)} next month to stay on track.`,
                { currentSpent: curSpent, limit: currentBudget, overBy, suggestedBudget: Math.round(currentBudget - suggestedCut) }
              );
            } else if (pct >= 80) {
              const remaining = Math.round(currentBudget - curSpent);
              addRec('monitor', 'medium', cat,
                `Monitor ${cat} budget`,
                `${cat} is at ${Math.round(pct)}% — only ${fmtAmount(remaining)} left. Reduce daily ${cat.toLowerCase()} expenses to avoid exceeding your limit.`,
                { currentSpent: curSpent, limit: currentBudget, remaining }
              );
            } else if (pct < 30 && monthlyAmounts.length >= 2 && avgMonthly > 0) {
              addRec('optimize', 'low', cat,
                `Optimize ${cat} budget`,
                `You've only used ${Math.round(pct)}% of your ${cat} budget. Consider reducing it to ${fmtAmount(Math.round(curSpent * 1.2))} and reallocating savings elsewhere.`,
                { currentSpent: curSpent, limit: currentBudget }
              );
            }
          } else if (data.count >= 3 && avgMonthly > 0) {
            const suggested = Math.round(avgMonthly * 1.1);
            addRec('create', 'medium', cat,
              `Create a ${cat} budget`,
              `You've spent ${fmtAmount(Math.round(avgMonthly))}/month on ${cat} over the last 3 months. Set a budget of ${fmtAmount(suggested)} to control this category.`,
              { suggestedBudget: suggested, avgMonthly: Math.round(avgMonthly) }
            );
          }
        });

        // --- 2. SAVINGS RATE ANALYSIS ---
        if (curMonthIncome > 0) {
          const curMonthSavings = curMonthIncome - totalCurMonth;
          const curSavingsRate = (curMonthSavings / curMonthIncome) * 100;

          if (curSavingsRate < 20) {
            const targetSavings = Math.round(curMonthIncome * 0.2);
            const gap = Math.max(0, targetSavings - curMonthSavings);
            if (gap > 0) {
              addRec('increase_savings', 'high', null,
                'Increase monthly savings',
                `Your savings rate is ${curSavingsRate.toFixed(1)}% this month. Save an additional ${fmtAmount(gap)} to reach the recommended 20% target (${fmtAmount(targetSavings)} of ${fmtAmount(curMonthIncome)}).`,
                { currentSavings: Math.round(curMonthSavings), targetSavings, gap, savingsRate: curSavingsRate.toFixed(1) }
              );
            }
          } else if (curSavingsRate >= 20 && curSavingsRate < 40) {
            addRec('good', 'low', null,
              'Healthy savings rate',
              `You're saving ${curSavingsRate.toFixed(1)}% of your income this month. Consider investing ${fmtAmount(Math.round(curMonthSavings * 0.3))} in SIPs or mutual funds for long-term growth.`,
              { savingsRate: curSavingsRate.toFixed(1) }
            );
          } else if (curSavingsRate >= 40) {
            addRec('good', 'low', null,
              'Excellent savings rate',
              `At ${curSavingsRate.toFixed(1)}%, you're saving significantly. Consider allocating ${fmtAmount(Math.round(curMonthSavings * 0.5))} to diversified investments.`,
              { savingsRate: curSavingsRate.toFixed(1) }
            );
          }
        }

        // --- 3. DISCRETIONARY SPENDING ANALYSIS ---
        const discretionaryCategories = ['Shopping', 'Entertainment', 'Food & Dining', 'Travel', 'Subscriptions', 'Personal Care'];
        let totalDiscretionary = 0;
        discretionaryCategories.forEach(cat => {
          totalDiscretionary += curMonthCatTotals[cat] || 0;
        });
        if (curMonthIncome > 0 && totalDiscretionary > 0) {
          const discretionaryPct = (totalDiscretionary / curMonthIncome) * 100;
          if (discretionaryPct > 30) {
            const reduceTarget = Math.round(totalDiscretionary * 0.2);
            const topDiscCat = discretionaryCategories
              .map(c => ({ cat: c, amt: curMonthCatTotals[c] || 0 }))
              .filter(c => c.amt > 0)
              .sort((a, b) => b.amt - a.amt)[0];

            addRec('reduce_discretionary', 'high', topDiscCat?.cat || 'Shopping',
              'Reduce discretionary spending',
              `Non-essential spending is ${discretionaryPct.toFixed(0)}% of income (${fmtAmount(totalDiscretionary)}). Cut ${fmtAmount(reduceTarget)} by reducing ${topDiscCat?.cat || 'Shopping'} and other discretionary categories.`,
              { totalDiscretionary, discretionaryPct: discretionaryPct.toFixed(1), topCategory: topDiscCat?.cat }
            );
          } else if (discretionaryPct > 20) {
            addRec('monitor', 'low', null,
              'Discretionary spending is moderate',
              `Non-essential spending is ${discretionaryPct.toFixed(0)}% of income (${fmtAmount(totalDiscretionary)}). Keep monitoring to prevent it from growing.`,
              { totalDiscretionary, discretionaryPct: discretionaryPct.toFixed(1) }
            );
          }
        }

        // --- 4. MONTH-OVER-MONTH TREND ANALYSIS ---
        if (totalPrevMonth > 0) {
          const expDiff = totalCurMonth - totalPrevMonth;
          const expPctChange = Math.round((expDiff / totalPrevMonth) * 100);
          if (expPctChange > 10) {
            const increaseAmt = Math.round(expDiff);
            // Find which categories increased the most
            const catDiffs = [];
            Object.keys(curMonthCatTotals).forEach(cat => {
              const cur = curMonthCatTotals[cat] || 0;
              const prev = categoryTotals[cat]?.monthly[prevMonth] || 0;
              if (cur > prev && cur - prev > 0) {
                catDiffs.push({ cat, diff: Math.round(cur - prev) });
              }
            });
            catDiffs.sort((a, b) => b.diff - a.diff);
            const topIncrease = catDiffs[0];

            addRec('trend_warning', 'high', topIncrease?.cat || null,
              `Expenses increased ${expPctChange}%`,
              `Spending rose from ${fmtAmount(totalPrevMonth)} to ${fmtAmount(totalCurMonth)} (+${fmtAmount(increaseAmt)}). ${topIncrease ? `Biggest increase: ${topIncrease.cat} (+${fmtAmount(topIncrease.diff)}).` : 'Review your recent purchases.'}`,
              { prevMonth: totalPrevMonth, curMonth: totalCurMonth, change: expPctChange }
            );
          } else if (expPctChange < -5) {
            addRec('good', 'low', null,
              `Expenses reduced by ${Math.abs(expPctChange)}%`,
              `Great job! Expenses dropped from ${fmtAmount(totalPrevMonth)} to ${fmtAmount(totalCurMonth)} — saving ${fmtAmount(Math.abs(expDiff))} compared to last month.`,
              { prevMonth: totalPrevMonth, curMonth: totalCurMonth, change: expPctChange }
            );
          }
        }

        if (prevMonthIncome > 0) {
          const incDiff = curMonthIncome - prevMonthIncome;
          const incPctChange = Math.round((incDiff / prevMonthIncome) * 100);
          if (incPctChange < -10) {
            addRec('trend_warning', 'high', null,
              `Income dropped ${Math.abs(incPctChange)}%`,
              `Income fell from ${fmtAmount(prevMonthIncome)} to ${fmtAmount(curMonthIncome)}. Reduce non-essential spending and explore additional income sources.`,
              { prevMonth: prevMonthIncome, curMonth: curMonthIncome, change: incPctChange }
            );
          } else if (incPctChange > 10) {
            addRec('good', 'low', null,
              `Income increased ${incPctChange}%`,
              `Income grew from ${fmtAmount(prevMonthIncome)} to ${fmtAmount(curMonthIncome)}. Allocate the extra ${fmtAmount(incDiff)} towards savings or debt repayment.`,
              { prevMonth: prevMonthIncome, curMonth: curMonthIncome, change: incPctChange }
            );
          }
        }

        // --- 5. EMERGENCY FUND CHECK ---
        const emergencyFund = goals.find(g => g.category === 'Emergency Fund');
        const monthsOfData = Math.max(1, Object.keys(categoryTotals).reduce((max, c) => Math.max(max, Object.keys(categoryTotals[c]?.monthly || {}).length), 0) || 1);
        const monthlyExpenses = totalCurMonth > 0 ? totalCurMonth : (totalExpenses / monthsOfData);
        if (!emergencyFund) {
          const targetAmount = Math.round(monthlyExpenses * 6);
          addRec('emergency_fund', 'high', null,
            'Create an emergency fund',
            `No emergency fund found. Aim for ${fmtAmount(targetAmount)} (6 months of expenses). Start by saving ${fmtAmount(Math.round(monthlyExpenses * 0.2))}/month.`,
            { targetAmount, monthlyExpenses: Math.round(monthlyExpenses) }
          );
        } else if (emergencyFund.targetAmount > 0) {
          const efPct = (emergencyFund.savedAmount / emergencyFund.targetAmount) * 100;
          if (efPct < 50) {
            const remaining = emergencyFund.targetAmount - emergencyFund.savedAmount;
            addRec('emergency_fund', 'medium', null,
              `Build your emergency fund`,
              `Emergency fund is ${efPct.toFixed(0)}% complete (${fmtAmount(emergencyFund.savedAmount)} of ${fmtAmount(emergencyFund.targetAmount)}). Add ${fmtAmount(Math.round(remaining / 6))}/month to reach your target in 6 months.`,
              { savedAmount: emergencyFund.savedAmount, targetAmount: emergencyFund.targetAmount, progress: efPct.toFixed(0) }
            );
          }
        }

        // --- 6. TOP SPENDING CATEGORY ALERT ---
        const sortedCats = Object.entries(curMonthCatTotals).sort((a, b) => b[1] - a[1]);
        if (sortedCats.length > 0 && totalCurMonth > 0) {
          const [topCat, topAmt] = sortedCats[0];
          const topPct = (topAmt / totalCurMonth) * 100;
          if (topPct > 35) {
            const reduceAmt = Math.round(topAmt * 0.15);
            addRec('reduce', 'medium', topCat,
              `${topCat} dominates spending`,
              `${topCat} accounts for ${topPct.toFixed(0)}% of your expenses (${fmtAmount(topAmt)}). Reduce by ${fmtAmount(reduceAmt)} (15%) to rebalance your budget.`,
              { category: topCat, amount: topAmt, percentage: topPct.toFixed(0), suggestedReduction: reduceAmt }
            );
          }
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

        res.json({
          recommendations: recommendations.slice(0, 10),
          overspendingAlerts,
          currentMonthBudgets,
          categorySpending: Object.entries(categoryTotals).map(([cat, data]) => ({
            category: cat,
            total: data.total,
            count: data.count,
            currentMonth: data.monthly[currentMonth] || 0,
          })).sort((a, b) => b.total - a.total),
          summary: {
            totalIncome,
            totalExpenses,
            curMonthIncome,
            curMonthExpenses: totalCurMonth,
            prevMonthExpenses: totalPrevMonth,
            savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 10) / 10 : 0,
          },
        });
      } catch (err) {
        console.error('[BUDGET RECOMMENDATIONS] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/analytics/financial-health', auth, async (req, res) => {
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

        // Budget utilization
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthBudgets = budgets.filter(b => b.month === currentMonth);
        let avgBudgetUtilization = 0;
        let budgetCount = 0;
        const categoryTotals = {};
        expenses.filter(e => {
          const m = new Date(e.date).toISOString().slice(0, 7);
          return m === currentMonth;
        }).forEach(e => {
          const cat = e.category || 'Other';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0);
        });

        currentMonthBudgets.forEach(b => {
          const spent = categoryTotals[b.category] || 0;
          const utilization = b.limit > 0 ? Math.min((spent / b.limit) * 100, 150) : 0;
          avgBudgetUtilization += utilization;
          budgetCount++;
        });
        avgBudgetUtilization = budgetCount > 0 ? Math.round(avgBudgetUtilization / budgetCount) : 0;

        // Score breakdown
        const scoreBreakdown = {};

        // 1. Savings Rate (max 30 points)
        if (savingsRate >= 30) { scoreBreakdown.savingsRate = { score: 30, max: 30, label: 'Excellent savings habit' }; }
        else if (savingsRate >= 20) { scoreBreakdown.savingsRate = { score: 25, max: 30, label: 'Good savings rate' }; }
        else if (savingsRate >= 10) { scoreBreakdown.savingsRate = { score: 15, max: 30, label: 'Room to save more' }; }
        else if (savingsRate > 0) { scoreBreakdown.savingsRate = { score: 5, max: 30, label: 'Savings rate needs improvement' }; }
        else { scoreBreakdown.savingsRate = { score: 0, max: 30, label: 'No savings detected' }; }

        // 2. Investment Growth (max 20 points)
        if (investmentGrowth > 10) { scoreBreakdown.investments = { score: 20, max: 20, label: 'Strong investment returns' }; }
        else if (investmentGrowth > 0) { scoreBreakdown.investments = { score: 15, max: 20, label: 'Positive growth' }; }
        else if (investmentGrowth === 0 && totalInvested === 0) { scoreBreakdown.investments = { score: 10, max: 20, label: 'No investments yet' }; }
        else { scoreBreakdown.investments = { score: 0, max: 20, label: 'Investments need attention' }; }

        // 3. Expense Ratio (max 20 points)
        if (expenseRatio < 50) { scoreBreakdown.expenses = { score: 20, max: 20, label: 'Expenses well controlled' }; }
        else if (expenseRatio < 70) { scoreBreakdown.expenses = { score: 15, max: 20, label: 'Moderate spending' }; }
        else if (expenseRatio < 85) { scoreBreakdown.expenses = { score: 8, max: 20, label: 'High expense ratio' }; }
        else { scoreBreakdown.expenses = { score: 0, max: 20, label: 'Spending exceeds healthy limits' }; }

        // 4. Debt-to-Income (max 15 points)
        if (debtToIncome < 15) { scoreBreakdown.debt = { score: 15, max: 15, label: 'Low debt burden' }; }
        else if (debtToIncome < 30) { scoreBreakdown.debt = { score: 10, max: 15, label: 'Manageable debt level' }; }
        else if (debtToIncome < 40) { scoreBreakdown.debt = { score: 5, max: 15, label: 'Debt level rising' }; }
        else { scoreBreakdown.debt = { score: 0, max: 15, label: 'High debt burden' }; }

        // 5. Goal Progress (max 15 points)
        const activeGoals = goals.filter(g => g.status === 'active' || g.status === 'overdue');
        const achievedGoals = goals.filter(g => g.status === 'achieved');
        if (goals.length > 0) {
          const goalCompletion = achievedGoals.length / goals.length;
          if (goalCompletion >= 0.5) { scoreBreakdown.goals = { score: 15, max: 15, label: 'Great goal progress' }; }
          else if (goalCompletion >= 0.25) { scoreBreakdown.goals = { score: 10, max: 15, label: 'Making progress on goals' }; }
          else { scoreBreakdown.goals = { score: 5, max: 15, label: 'Keep working toward goals' }; }
        } else {
          scoreBreakdown.goals = { score: 5, max: 15, label: 'No goals set yet' };
        }

        let score = Object.values(scoreBreakdown).reduce((s, v) => s + v.score, 0);
        score = Math.max(0, Math.min(100, score));

        let status;
        if (score >= 80) status = 'Excellent';
        else if (score >= 60) status = 'Good';
        else if (score >= 40) status = 'Fair';
        else status = 'Poor';

        // Generate insights with explanations
        const insights = [];
        if (savingsRate < 20) insights.push({ type: 'critical', text: `Your savings rate is ${savingsRate}%. Aim for at least 20% of income. ${fmtAmount(Math.max(savings, 0))} saved so far.` });
        else if (savingsRate >= 30) insights.push({ type: 'good', text: `Excellent! You're saving ${savingsRate}% of your income (${fmtAmount(savings)}). Keep it up!` });

        if (expenseRatio > 80) insights.push({ type: 'critical', text: `You're spending ${expenseRatio}% of your income. Try to reduce expenses below 70%.` });
        else if (expenseRatio < 60) insights.push({ type: 'good', text: `Your expense ratio is healthy at ${expenseRatio}%. You're living within your means.` });

        if (investmentGrowth < 0) insights.push({ type: 'warning', text: `Your investments have declined by ${Math.abs(investmentGrowth)}%. Consider reviewing your portfolio allocation.` });
        else if (investmentGrowth > 10) insights.push({ type: 'good', text: `Great! Your investments grew by ${investmentGrowth}%. Portfolio value: ${fmtAmount(totalCurrentValue)}.` });

        if (debtToIncome > 30) insights.push({ type: 'critical', text: `Your debt-to-income ratio is ${debtToIncome}%. Try to reduce recurring obligations below 30%.` });

        if (avgBudgetUtilization > 100) insights.push({ type: 'critical', text: `You're over budget by ${Math.round(avgBudgetUtilization - 100)}% on average. Review your spending categories.` });
        else if (avgBudgetUtilization > 80 && avgBudgetUtilization <= 100) insights.push({ type: 'warning', text: `Budget utilization is at ${Math.round(avgBudgetUtilization)}%. You're close to your limits.` });
        else if (avgBudgetUtilization > 0 && avgBudgetUtilization < 60) insights.push({ type: 'good', text: `Budget utilization is ${Math.round(avgBudgetUtilization)}%. Well within your planned limits.` });

        if (activeGoals.length > 3) insights.push({ type: 'warning', text: `You have ${activeGoals.length} active goals. Focus on fewer goals for better progress.` });

        const emergencyFund = goals.find(g => g.category === 'Emergency Fund');
        if (emergencyFund) {
          const efPct = emergencyFund.targetAmount > 0 ? (emergencyFund.savedAmount / emergencyFund.targetAmount) * 100 : 0;
          if (efPct < 50) insights.push({ type: 'critical', text: `Emergency Fund is only ${Math.round(efPct)}% complete. Prioritize building 3-6 months of expenses.` });
        } else {
          insights.push({ type: 'warning', text: 'No Emergency Fund goal found. Create one to protect against unexpected expenses.' });
        }

        res.json({
          score,
          status,
          indicators: {
            savingsRate,
            investmentGrowth,
            expenseRatio,
            investmentRatio,
            debtToIncome,
            avgBudgetUtilization,
          },
          summary: {
            totalIncome,
            totalExpenses,
            savings,
            totalInvested,
            totalCurrentValue,
          },
          scoreBreakdown,
          insights,
          activeGoals: activeGoals.length,
          achievedGoals: achievedGoals.length,
          totalGoals: goals.length,
          lastUpdated: new Date(),
        });
      } catch (err) {
        console.error('[FINANCIAL HEALTH] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/notifications', auth, async (req, res) => {
      try {
        const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
        res.json({ notifications, unreadCount });
      } catch (err) {
        console.error('[NOTIFICATIONS GET] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/notifications/:id/read', auth, async (req, res) => {
      try {
        const notification = await Notification.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { read: true },
          { new: true }
        );
        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        res.json(notification);
      } catch (err) {
        console.error('[NOTIFICATION READ] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/notifications/read-all', auth, async (req, res) => {
      try {
        await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
        res.json({ success: true });
      } catch (err) {
        console.error('[NOTIFICATIONS READ ALL] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/notifications/:id', auth, async (req, res) => {
      try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
      } catch (err) {
        console.error('[NOTIFICATION DELETE] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/notifications/generate', auth, async (req, res) => {
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
        expenses.filter(e => {
          const m = new Date(e.date).toISOString().slice(0, 7);
          return m === currentMonth;
        }).forEach(e => {
          const cat = e.category || 'Other';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount || 0);
        });

        currentMonthBudgets.forEach(b => {
          const spent = categoryTotals[b.category] || 0;
          const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
          if (pct >= 100) {
            newNotifications.push({
              userId: req.userId, type: 'budget_exceeded',
              title: `Budget Exceeded: ${b.category}`,
              message: `You've exceeded your ${b.category} budget by ${fmtAmount(spent - b.limit)} this month.`,
              priority: 'critical', category: b.category, amount: spent,
            });
          } else if (pct >= 80) {
            newNotifications.push({
              userId: req.userId, type: 'budget_warning',
              title: `Budget Warning: ${b.category}`,
              message: `Your ${b.category} budget is at ${Math.round(pct)}%. You have ${fmtAmount(b.limit - spent)} remaining.`,
              priority: 'medium', category: b.category, amount: spent,
            });
          }
        });

        goals.forEach(g => {
          if (g.status === 'overdue') {
            newNotifications.push({
              userId: req.userId, type: 'goal_overdue',
              title: `Goal Overdue: ${g.goalName}`,
              message: `"${g.goalName}" has passed its target date. ${fmtAmount(Math.max(g.targetAmount - g.savedAmount, 0))} still needed.`,
              priority: 'high', category: g.category,
            });
          } else if (g.status === 'active' && g.targetDate) {
            const daysLeft = Math.ceil((new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24));
            const pct = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
            const remaining = Math.max(g.targetAmount - g.savedAmount, 0);
            if (daysLeft <= 7 && daysLeft > 0) {
              newNotifications.push({
                userId: req.userId, type: 'goal_deadline_urgent',
                title: `Urgent: ${g.goalName} Due Soon`,
                message: `"${g.goalName}" deadline is in ${daysLeft} days! You've saved ${pct}% (${fmtAmount(g.savedAmount)} of ${fmtAmount(g.targetAmount)}). ${fmtAmount(remaining)} still needed.`,
                priority: 'high', category: g.category,
              });
            } else if (daysLeft <= 30 && daysLeft > 7) {
              newNotifications.push({
                userId: req.userId, type: 'goal_reminder',
                title: `Goal Deadline: ${g.goalName}`,
                message: `"${g.goalName}" deadline is in ${daysLeft} days. Current progress: ${pct}%. ${fmtAmount(remaining)} remaining.`,
                priority: 'medium', category: g.category,
              });
            }
            if (g.monthlySaving > 0 && daysLeft > 0) {
              const monthsLeft = daysLeft / 30;
              const neededPerMonth = remaining / monthsLeft;
              if (neededPerMonth > g.monthlySaving * 1.5) {
                newNotifications.push({
                  userId: req.userId, type: 'goal_reminder',
                  title: `Goal Behind Schedule: ${g.goalName}`,
                  message: `To reach "${g.goalName}" on time, you need to save ${fmtAmount(neededPerMonth)}/month — ${Math.round(((neededPerMonth / g.monthlySaving) - 1) * 100)}% more than your current plan of ${fmtAmount(g.monthlySaving)}/month.`,
                  priority: 'high', category: g.category,
                });
              }
            }
          }
        });

        investments.filter(inv => inv.status === 'active').forEach(inv => {
          const curr = inv.currentValue != null ? inv.currentValue : inv.amount;
          const retPct = inv.amount > 0 ? ((curr - inv.amount) / inv.amount) * 100 : 0;
          if (retPct < -10) {
            newNotifications.push({
              userId: req.userId, type: 'investment_loss',
              title: `Investment Loss: ${inv.name}`,
              message: `${inv.name} has declined by ${Math.abs(Math.round(retPct))}%. Current value: ${fmtAmount(curr)}.`,
              priority: 'high',
            });
          } else if (retPct > 15) {
            newNotifications.push({
              userId: req.userId, type: 'investment_gain',
              title: `Investment Gain: ${inv.name}`,
              message: `${inv.name} has gained ${Math.round(retPct)}%. Current value: ${fmtAmount(curr)}.`,
              priority: 'low',
            });
          }
        });

        const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        if (totalIncome > 0) {
          const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
          if (savingsRate < 10 && totalExpenses > 0) {
            newNotifications.push({
              userId: req.userId, type: 'low_savings',
              title: 'Low Savings Alert',
              message: `Your savings rate is only ${Math.round(savingsRate)}%. Try to save at least 20% of your income.`,
              priority: 'high',
            });
          }
        }

        // --- UNUSUAL SPENDING ALERT (compare current month vs 3-month average) ---
        const getMonthKey = (date) => new Date(date).toISOString().slice(0, 7);
        const monthCounts = {};
        expenses.forEach(e => {
          const m = getMonthKey(e.date);
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        });
        const sortedMonths = Object.keys(monthCounts).sort().reverse();
        const prevMonths = sortedMonths.filter(m => m < currentMonth).slice(0, 3);

        if (prevMonths.length >= 2) {
          const prevCategoryTotals = {};
          const prevMonthCount = prevMonths.length;
          expenses.filter(e => prevMonths.includes(getMonthKey(e.date))).forEach(e => {
            const cat = e.category || 'Other';
            prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + Number(e.amount || 0);
          });

          Object.keys(categoryTotals).forEach(cat => {
            const currentSpent = categoryTotals[cat];
            const prevAvg = (prevCategoryTotals[cat] || 0) / prevMonthCount;
            if (prevAvg > 0 && currentSpent > prevAvg * 1.5) {
              const increasePct = Math.round(((currentSpent - prevAvg) / prevAvg) * 100);
              newNotifications.push({
                userId: req.userId, type: 'unusual_spending',
                title: `Unusual Spending: ${cat}`,
                message: `Your ${cat} spending this month (${fmtAmount(currentSpent)}) is ${increasePct}% higher than your average of ${fmtAmount(Math.round(prevAvg))}/month over the last ${prevMonthCount} months.`,
                priority: 'high', category: cat, amount: currentSpent,
              });
            }
          });
        }

        // --- INVESTMENT REMINDER (check for stale or underperforming investments) ---
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        investments.filter(inv => inv.status === 'active').forEach(inv => {
          const lastUpdated = inv.updatedAt || inv.createdAt;
          const daysSinceUpdate = Math.floor((now - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
          if (daysSinceUpdate > 90) {
            newNotifications.push({
              userId: req.userId, type: 'investment_reminder',
              title: `Review Investment: ${inv.name}`,
              message: `"${inv.name}" hasn't been updated in ${daysSinceUpdate} days. Consider reviewing its performance and current value.`,
              priority: 'medium',
            });
          }
          if (inv.expectedReturns > 0 && inv.amount > 0) {
            const actualReturn = inv.currentValue > 0 ? ((inv.currentValue - inv.amount) / inv.amount) * 100 : 0;
            const timeHeld = Math.max(1, Math.floor((now - new Date(inv.investedDate)) / (1000 * 60 * 60 * 24)));
            const annualizedExpected = inv.expectedReturns;
            const annualizedActual = (actualReturn / timeHeld) * 365;
            if (timeHeld > 180 && annualizedActual < annualizedExpected * 0.5) {
              newNotifications.push({
                userId: req.userId, type: 'investment_reminder',
                title: `Underperforming: ${inv.name}`,
                message: `"${inv.name}" is returning ${Math.round(annualizedActual)}% annually vs your expected ${annualizedExpected}%. Consider rebalancing or reviewing your strategy.`,
                priority: 'medium',
              });
            }
          }
        });

        const existingTypes = newNotifications.map(n => `${n.type}_${n.category || ''}`);
        const uniqueNew = newNotifications.filter((n, i) => {
          const key = `${n.type}_${n.category || ''}`;
          return existingTypes.indexOf(key) === i;
        });

        let created = [];
        if (uniqueNew.length > 0) {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          // Batch check for existing notifications
          const existingNotifs = await Notification.find({
            userId: req.userId,
            createdAt: { $gte: thirtyDaysAgo },
          }).select('type category').lean();
          const existingSet = new Set(existingNotifs.map(n => `${n.type}_${n.category || ''}`));

          const toInsert = uniqueNew.filter(n => {
            const key = `${n.type}_${n.category || ''}`;
            return !existingSet.has(key);
          });

          if (toInsert.length > 0) {
            const inserted = await Notification.insertMany(toInsert, { ordered: false });
            created = inserted;
          }
        }

        const allNotifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
        res.json({ notifications: allNotifications, unreadCount, newCount: created.length });
      } catch (err) {
        console.error('[NOTIFICATIONS GENERATE] Error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // ===== User Profile & Settings Endpoints =====

    app.get('/api/user/account-info', auth, async (req, res) => {
      try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture || '',
          currency: user.currency || 'INR',
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          passwordChangedAt: user.passwordChangedAt,
        });
      } catch (err) {
        console.error('[ACCOUNT INFO] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/user/profile', auth, async (req, res) => {
      try {
        const { name, profilePicture } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (name !== undefined) {
          const sanitizedName = sanitizeString(name, 100);
          if (!sanitizedName || sanitizedName.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
          user.name = sanitizedName;
        }
        if (profilePicture !== undefined) {
          if (profilePicture && !profilePicture.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
          }
          if (profilePicture && profilePicture.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image size must be less than 5MB' });
          }
          user.profilePicture = profilePicture;
        }
        await user.save();
        res.json({
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture || '',
          currency: user.currency || 'INR',
        });
      } catch (err) {
        console.error('[UPDATE PROFILE] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/user/profile-picture', auth, async (req, res) => {
      try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.profilePicture = '';
        await user.save();
        res.json({ success: true });
      } catch (err) {
        console.error('[REMOVE PROFILE PICTURE] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/user/password', auth, async (req, res) => {
      try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordChangedAt = new Date();
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
      } catch (err) {
        console.error('[CHANGE PASSWORD] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/user/currency', auth, async (req, res) => {
      try {
        const { currency } = req.body;
        const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
        if (!validCurrencies.includes(currency)) return res.status(400).json({ error: 'Invalid currency' });
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.currency = currency;
        await user.save();
        res.json({ success: true, currency: user.currency });
      } catch (err) {
        console.error('[UPDATE CURRENCY] Error:', err.message);
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
          Notification.deleteMany({ userId: req.userId }),
        ]);
        const total = results.reduce((s, r) => s + r.deletedCount, 0);
        console.log(`[CLEAR DATA] Deleted ${total} records for user ${req.userId}`);
        res.json({ success: true, deletedCount: total });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // ─── ML Service Routes ─────────────────────────────────────────────
    app.get('/api/ml/health', auth, async (req, res) => {
      try {
        const healthy = await mlService.checkHealth();
        res.json({ mlServiceAvailable: healthy });
      } catch (err) {
        res.json({ mlServiceAvailable: false });
      }
    });

    app.get('/api/ml/financial-insights', auth, async (req, res) => {
      try {
        const result = await mlService.getFinancialInsights(
          req.userId, Income, Expense, Budget, Goal, Investment
        );
        if (result.ok) {
          res.json(result.data);
        } else {
          res.status(503).json({ error: result.error, fallback: true });
        }
      } catch (err) {
        console.error('[ML ROUTE] financial-insights error:', err.message);
        res.status(500).json({ error: 'ML service error', fallback: true });
      }
    });

    app.get('/api/ml/predictions', auth, async (req, res) => {
      try {
        const result = await mlService.getPredictions(req.userId, Income, Expense);
        if (result.ok) {
          res.json(result.data);
        } else {
          res.status(503).json({ error: result.error, fallback: true });
        }
      } catch (err) {
        console.error('[ML ROUTE] predictions error:', err.message);
        res.status(500).json({ error: 'ML service error', fallback: true });
      }
    });

    app.post('/api/ml/analyze', auth, async (req, res) => {
      try {
        const [incomes, expenses, budgets, goals, investments] = await Promise.all([
          Income.find({ userId: req.userId }).sort({ date: -1 }).limit(120).lean(),
          Expense.find({ userId: req.userId }).sort({ date: -1 }).limit(120).lean(),
          Budget.find({ userId: req.userId }).lean(),
          Goal.find({ userId: req.userId }).lean(),
          Investment.find({ userId: req.userId }).lean(),
        ]);
        const monthlyData = mlService.buildMonthlyData(incomes, expenses, goals, investments);
        const result = await require('../services/mlService').callML('/analyze', { monthly: monthlyData });
        if (result.ok) {
          res.json(result.data);
        } else {
          res.status(503).json({ error: result.error, fallback: true });
        }
      } catch (err) {
        console.error('[ML ROUTE] analyze error:', err.message);
        res.status(500).json({ error: 'ML service error', fallback: true });
      }
    });

    // Report routes
    app.use('/api/reports', reportRoutes);

    // Export routes
    app.use('/api/export', exportRoutes);

    // JARVIS conversational AI routes
    app.use('/api/jarvis', jarvisRoutes);

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('[GLOBAL ERROR]', err.message);
      res.status(500).json({ error: 'Internal server error' });
    });

    const port = process.env.PORT || 4000;
    const server = app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        mongoose.disconnect().then(() => {
          console.log('MongoDB disconnected. Server closed.');
          process.exit(0);
        });
      });
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('');
    console.error('=== TROUBLESHOOTING ===');
    console.error('1. Check if your MongoDB Atlas cluster is active (not paused)');
    console.error('   -> Go to https://cloud.mongodb.com and verify cluster status');
    console.error('2. Check your IP whitelist in Atlas');
    console.error('   -> Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0)');
    console.error('3. Verify your MongoDB username and password');
    console.error('4. Try switching to local MongoDB:');
    console.error('   -> Uncomment this line in backend/.env:');
    console.error('   -> MONGODB_URI=mongodb://localhost:27017/smart_finance');
    console.error('5. Check your network/firewall is not blocking DNS SRV queries');
    console.error('======================');
    process.exit(1);
  }
}

startServer();
