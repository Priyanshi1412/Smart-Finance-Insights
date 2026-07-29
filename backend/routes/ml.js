const express = require('express');
const router = express.Router();
const { getHealth, getFinancialInsights, getPredictions, analyze } = require('../controllers/mlController');
const auth = require('../middleware/auth');

router.get('/health', auth, getHealth);
router.get('/financial-insights', auth, getFinancialInsights);
router.get('/predictions', auth, getPredictions);
router.post('/analyze', auth, analyze);

module.exports = router;
