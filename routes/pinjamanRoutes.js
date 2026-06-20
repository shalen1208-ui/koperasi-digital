const express = require('express');
const router = express.Router();
const { getAllPinjaman, getPinjamanById, ajukanPinjaman, prosesPinjaman, simulasiPinjaman } = require('../controllers/pinjamanController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/simulasi', verifyToken, authorizeRole('admin', 'anggota'), simulasiPinjaman);
router.get('/', verifyToken, authorizeRole('admin', 'anggota'), getAllPinjaman);
router.get('/:id', verifyToken, authorizeRole('admin', 'anggota'), getPinjamanById);
router.post('/', verifyToken, authorizeRole('anggota'), ajukanPinjaman);
router.put('/:id/proses', verifyToken, authorizeRole('admin'), prosesPinjaman);

module.exports = router;