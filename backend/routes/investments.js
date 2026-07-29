const express = require('express');
const router = express.Router();
const { create, getAll, update, remove, getAnalytics } = require('../controllers/investmentController');
const auth = require('../middleware/auth');

router.post('/', auth, create);
router.get('/', auth, getAll);
router.get('/analytics', auth, getAnalytics);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
