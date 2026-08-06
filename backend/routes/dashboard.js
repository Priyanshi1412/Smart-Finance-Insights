const express = require('express');
const router = express.Router();
const { getSummary, getRecentTransactions, getDashboardOverview } = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

router.get('/summary', auth, getSummary);
router.get('/recent-transactions', auth, getRecentTransactions);
router.get('/overview', auth, getDashboardOverview);

module.exports = router;
