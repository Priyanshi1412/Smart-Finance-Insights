const express = require('express');
const router = express.Router();
const { getSummary, getRecentTransactions } = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

router.get('/summary', auth, getSummary);
router.get('/recent-transactions', auth, getRecentTransactions);

module.exports = router;
