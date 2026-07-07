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
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const investmentSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      category: { type: String, required: true },
      amount: { type: Number, required: true },
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
      const { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate } = req.body;
      if (!goalName || !category || !targetAmount || !targetDate) return res.status(400).json({ error: 'Missing fields' });
      try {
        const goal = new Goal({
          userId: req.userId, goalName, category, targetAmount,
          savedAmount: savedAmount || 0, monthlySaving: monthlySaving || 0, targetDate
        });
        await goal.save();
        res.status(201).json(goal);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.get('/api/goals', auth, async (req, res) => {
      try {
        const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });
        res.json(goals);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.put('/api/goals/:id', auth, async (req, res) => {
      const { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate } = req.body;
      try {
        const goal = await Goal.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { goalName, category, targetAmount, savedAmount, monthlySaving, targetDate, updatedAt: Date.now() },
          { new: true }
        );
        if (!goal) return res.status(404).json({ error: 'Goal not found' });
        res.json(goal);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.delete('/api/goals/:id', auth, async (req, res) => {
      try {
        await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    app.post('/api/investments', auth, async (req, res) => {
      const { name, type, category, amount, investedDate, expectedReturns, status, notes } = req.body;
      if (!name || !type || !category || !amount) return res.status(400).json({ error: 'Missing fields' });
      try {
        const investment = new Investment({
          userId: req.userId, name, type, category, amount,
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
      const { name, type, category, amount, investedDate, expectedReturns, status, notes } = req.body;
      try {
        const investment = await Investment.findOneAndUpdate(
          { _id: req.params.id, userId: req.userId },
          { name, type, category, amount, investedDate, expectedReturns, status, notes, updatedAt: Date.now() },
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
