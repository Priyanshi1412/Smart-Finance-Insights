const express = require('express');
const router = express.Router();
const { getAccountInfo, updateProfile, removeProfilePicture, changePassword, updateCurrency, clearData } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/account-info', auth, getAccountInfo);
router.put('/profile', auth, updateProfile);
router.delete('/profile-picture', auth, removeProfilePicture);
router.put('/password', auth, changePassword);
router.put('/currency', auth, updateCurrency);

module.exports = router;
