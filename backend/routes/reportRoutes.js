const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMonthlyExpenses,
  getBudgetUtilization,
  getInvestmentPerformance,
  getGoalProgress,
  exportCSV,
  exportPDF,
} = require('../controllers/reportController');

router.get('/monthly-expenses', auth, getMonthlyExpenses);
router.get('/budget-utilization', auth, getBudgetUtilization);
router.get('/investment-performance', auth, getInvestmentPerformance);
router.get('/goal-progress', auth, getGoalProgress);
router.get('/export/csv', auth, exportCSV);
router.get('/export/pdf', auth, exportPDF);

module.exports = router;
