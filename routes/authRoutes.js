const express = require('express');
const router = express.Router();
const { register, login, getProfil } = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/profil
router.get('/profil', verifyToken, getProfil);

module.exports = router;