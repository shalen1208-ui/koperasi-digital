const express = require('express');
const router = express.Router();
const { getStatistikAdmin, getStatistikAnggota } = require('../controllers/dashboardController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/admin', verifyToken, authorizeRole('admin'), getStatistikAdmin);
router.get('/anggota', verifyToken, authorizeRole('anggota'), getStatistikAnggota);

module.exports = router;