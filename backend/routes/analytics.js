const express = require('express');
const router = express.Router();
const { getSpendingPatterns, getBudgetRecommendations, getFinancialHealth } = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

router.get('/spending-patterns', auth, getSpendingPatterns);
router.get('/budget-recommendations', auth, getBudgetRecommendations);
router.get('/financial-health', auth, getFinancialHealth);

module.exports = router;
