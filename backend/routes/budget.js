const express = require('express');
const router = express.Router();
const { create, getAll } = require('../controllers/budgetController');
const auth = require('../middleware/auth');

router.post('/', auth, create);
router.get('/', auth, getAll);

module.exports = router;
