const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  importExpenses,
  importIncome,
  downloadExpenseTemplate,
  downloadIncomeTemplate,
} = require('../controllers/importController');

router.post('/expenses', auth, importExpenses);
router.post('/income', auth, importIncome);
router.get('/template/expenses', downloadExpenseTemplate);
router.get('/template/income', downloadIncomeTemplate);

module.exports = router;
