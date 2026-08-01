const express = require('express');
const router = express.Router();
const { create, getAll, update, remove } = require('../controllers/budgetController');
const auth = require('../middleware/auth');

router.get('/', auth, getAll);
router.post('/', auth, create);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
