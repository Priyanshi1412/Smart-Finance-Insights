const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const ML_TIMEOUT = parseInt(process.env.ML_TIMEOUT, 10) || 10000;
const ML_RETRIES = parseInt(process.env.ML_RETRIES, 10) || 2;

let mlAvailable = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkHealth() {
  const now = Date.now();
  if (mlAvailable !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return mlAvailable;
  }
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    mlAvailable = res.data?.status === 'ok';
  } catch {
    mlAvailable = false;
  }
  lastHealthCheck = now;
  return mlAvailable;
}

async function callML(endpoint, payload, retries = ML_RETRIES) {
  const isHealthy = await checkHealth();
  if (!isHealthy) {
    return { ok: false, error: 'ML service unavailable', fallback: true };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(`${ML_SERVICE_URL}${endpoint}`, payload, {
        timeout: ML_TIMEOUT,
        headers: { 'Content-Type': 'application/json' },
      });
      return { ok: true, data: res.data };
    } catch (err) {
      const isLast = attempt === retries;
      const isRetryable = !err.response || err.response.status >= 500;

      if (isLast || !isRetryable) {
        const msg = err.response?.data?.error || err.message || 'ML request failed';
        console.error(`[ML] ${endpoint} failed (attempt ${attempt + 1}): ${msg}`);
        return { ok: false, error: msg, fallback: true };
      }

      await sleep(500 * (attempt + 1));
    }
  }

  return { ok: false, error: 'Max retries exceeded', fallback: true };
}

function buildMonthlyData(incomes, expenses, goals, investments) {
  const months = {};

  incomes.forEach(inc => {
    const d = new Date(inc.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { month: key, income: 0, expenses: 0, savings: 0 };
    months[key].income += Number(inc.amount) || 0;
  });

  expenses.forEach(exp => {
    const d = new Date(exp.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[key]) months[key] = { month: key, income: 0, expenses: 0, savings: 0 };
    months[key].expenses += Number(exp.amount) || 0;
  });

  Object.values(months).forEach(m => {
    m.savings = m.income - m.expenses;
  });

  const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));

  return sorted.slice(-12);
}

async function getFinancialInsights(userId, Income, Expense, Budget, Goal, Investment) {
  try {
    const [incomes, expenses, budgets, goals, investments] = await Promise.all([
      Income.find({ userId }).sort({ date: -1 }).limit(120).lean(),
      Expense.find({ userId }).sort({ date: -1 }).limit(120).lean(),
      Budget.find({ userId }).lean(),
      Goal.find({ userId }).lean(),
      Investment.find({ userId }).lean(),
    ]);

    const monthlyData = buildMonthlyData(incomes, expenses, goals, investments);

    if (monthlyData.length < 2) {
      return {
        ok: true,
        data: {
          predictions: {
            predictedSavingsNextMonth: 0,
            predictedExpensesNextMonth: 0,
            savingsTrend: 'stable',
            expenseTrend: 'stable',
            incomeTrend: 'stable',
          },
          financialHealth: { score: 50, status: 'Insufficient Data', breakdown: {} },
          recommendations: [{ type: 'general', priority: 'low', title: 'Add more data', message: 'Enter at least 2 months of income and expenses for ML predictions.' }],
          source: 'ml',
          dataPoints: monthlyData.length,
        },
      };
    }

    const result = await callML('/analyze', { monthly: monthlyData });

    if (!result.ok) {
      return { ok: false, error: result.error, fallback: true };
    }

    return {
      ok: true,
      data: {
        ...result.data,
        source: 'ml',
        dataPoints: monthlyData.length,
      },
    };
  } catch (err) {
    console.error('[ML] getFinancialInsights error:', err.message);
    return { ok: false, error: err.message, fallback: true };
  }
}

async function getPredictions(userId, Income, Expense) {
  try {
    const [incomes, expenses] = await Promise.all([
      Income.find({ userId }).sort({ date: -1 }).limit(60).lean(),
      Expense.find({ userId }).sort({ date: -1 }).limit(60).lean(),
    ]);

    const monthlyData = buildMonthlyData(incomes, expenses, [], []);

    if (monthlyData.length < 2) {
      return {
        ok: true,
        data: {
          savings: { predictedSavingsNextMonth: 0, trend: 'stable', dataPoints: monthlyData.length },
          expenses: { predictedExpensesNextMonth: 0, trend: 'stable', dataPoints: monthlyData.length },
          source: 'ml',
        },
      };
    }

    const [savResult, expResult] = await Promise.all([
      callML('/predict/savings', { monthly: monthlyData }),
      callML('/predict/expenses', { monthly: monthlyData }),
    ]);

    return {
      ok: true,
      data: {
        savings: savResult.ok ? savResult.data : { predictedSavingsNextMonth: 0, trend: 'unknown' },
        expenses: expResult.ok ? expResult.data : { predictedExpensesNextMonth: 0, trend: 'unknown' },
        source: 'ml',
      },
    };
  } catch (err) {
    console.error('[ML] getPredictions error:', err.message);
    return { ok: false, error: err.message, fallback: true };
  }
}

module.exports = {
  checkHealth,
  getFinancialInsights,
  getPredictions,
  buildMonthlyData,
  callML,
};
