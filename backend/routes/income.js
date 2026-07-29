const express = require('express');
const router = express.Router();
const { create, getAll, update, remove } = require('../controllers/incomeController');
const auth = require('../middleware/auth');

router.post('/', auth, create);
router.get('/', auth, getAll);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
