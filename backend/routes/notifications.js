const express = require('express');
const router = express.Router();
const { getAll, markAsRead, markAllRead, remove, generate } = require('../controllers/notificationController');
const auth = require('../middleware/auth');

router.get('/', auth, getAll);
router.put('/read-all', auth, markAllRead);
router.put('/:id/read', auth, markAsRead);
router.delete('/:id', auth, remove);
router.post('/generate', auth, generate);

module.exports = router;
