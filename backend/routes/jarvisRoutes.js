const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { chat } = require('../controllers/jarvisController');

router.post('/chat', auth, chat);

module.exports = router;
