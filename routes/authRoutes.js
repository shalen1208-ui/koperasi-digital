const express = require('express');
const router = express.Router();
const { register, login, getProfil, gantiPassword, lupaPassword, resetPassword, cekToken, requestBantuanPassword } = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profil', verifyToken, getProfil);
router.put('/ganti-password', verifyToken, gantiPassword);
router.post('/lupa-password', lupaPassword);
router.post('/reset-password', resetPassword);
router.get('/cek-token', cekToken);
router.post('/minta-bantuan', requestBantuanPassword);

module.exports = router;