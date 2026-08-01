const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  exportExpensePDF,
  exportInvestmentExcel,
  exportFinancialPDF,
  exportGoalPDF,
  unifiedExport,
} = require('../controllers/exportController');

router.get('/expenses/pdf', auth, exportExpensePDF);
router.get('/investments/excel', auth, exportInvestmentExcel);
router.get('/financial-report/pdf', auth, exportFinancialPDF);
router.get('/goals/pdf', auth, exportGoalPDF);

router.get('/:type/:format', auth, unifiedExport);

module.exports = router;
