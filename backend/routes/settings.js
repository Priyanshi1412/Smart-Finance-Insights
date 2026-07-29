const express = require('express');
const router = express.Router();
const { clearData } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.delete('/clear-data', auth, clearData);

module.exports = router;
