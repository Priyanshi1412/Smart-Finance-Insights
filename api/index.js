const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');

const app = express();

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(mongoSanitize());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

const { ObjectId } = mongoose.Types;
app.param('id', (req, res, next, value) => {
  if (!ObjectId.isValid(value)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
});

const authRoutes = require('../backend/routes/auth');
const dashboardRoutes = require('../backend/routes/dashboard');
const incomeRoutes = require('../backend/routes/income');
const expenseRoutes = require('../backend/routes/expenses');
const budgetRoutes = require('../backend/routes/budget');
const goalRoutes = require('../backend/routes/goals');
const investmentRoutes = require('../backend/routes/investments');
const portfolioRoutes = require('../backend/routes/portfolio');
const analyticsRoutes = require('../backend/routes/analytics');
const notificationRoutes = require('../backend/routes/notifications');
const userRoutes = require('../backend/routes/user');
const mlRoutes = require('../backend/routes/ml');
const settingsRoutes = require('../backend/routes/settings');
const reportRoutes = require('../backend/routes/reportRoutes');
const jarvisRoutes = require('../backend/routes/jarvisRoutes');
const exportRoutes = require('../backend/routes/export');

app.use('/api', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/jarvis', jarvisRoutes);
app.use('/api/export', exportRoutes);
app.use('/api', settingsRoutes);

const errorHandler = require('../backend/middleware/errorHandler');
app.use(errorHandler);

module.exports = async (req, res) => {
  await connectToDatabase();
  return app(req, res);
};
