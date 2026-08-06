const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { ObjectId } = require('mongoose').Types;

const app = express();

// Security headers
app.use(helmet());

// Body parser with size limit
app.use(express.json({ limit: '10kb' }));

// CORS
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Sanitize MongoDB queries
app.use(mongoSanitize());

// Rate limiting
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

// ObjectID param validation
app.param('id', (req, res, next, value) => {
  if (!ObjectId.isValid(value)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');
const goalRoutes = require('./routes/goals');
const investmentRoutes = require('./routes/investments');
const portfolioRoutes = require('./routes/portfolio');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/user');
const mlRoutes = require('./routes/ml');
const settingsRoutes = require('./routes/settings');
const reportRoutes = require('./routes/reportRoutes');
const jarvisRoutes = require('./routes/jarvisRoutes');
const exportRoutes = require('./routes/export');

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

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('');
    console.error('=== TROUBLESHOOTING ===');
    console.error('1. Check if your MongoDB Atlas cluster is active (not paused)');
    console.error('2. Check your IP whitelist in Atlas (Network Access -> Allow 0.0.0.0/0)');
    console.error('3. Verify your MongoDB username and password in backend/.env');
    console.error('4. Try local MongoDB: Uncomment MONGODB_URI in backend/.env');
    console.error('5. Check your network is not blocking DNS SRV queries');
    console.error('======================');
    process.exit(1);
  }

  const port = process.env.PORT || 4000;
  const server = app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      const mongoose = require('mongoose');
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
}

startServer();
