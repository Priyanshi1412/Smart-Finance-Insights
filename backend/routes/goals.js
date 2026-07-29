const express = require('express');
const router = express.Router();
const { create, getAll, update, remove, addContribution, getAnalytics } = require('../controllers/goalController');
const auth = require('../middleware/auth');

router.post('/', auth, create);
router.get('/', auth, getAll);
router.get('/analytics', auth, getAnalytics);
router.put('/:id', auth, update);
router.delete('/:id', auth, remove);
router.post('/:id/contributions', auth, addContribution);

module.exports = router;
