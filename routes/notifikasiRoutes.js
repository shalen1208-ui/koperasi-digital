const express = require('express');
const router = express.Router();
const { getNotifikasi, getJumlahBelumDibaca, tandaiDibaca, tandaiSemuaDibaca, hapusNotifikasi, hapusSemuaNotifikasi } = require('../controllers/notifikasiController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/', verifyToken, authorizeRole('admin', 'anggota'), getNotifikasi);
router.get('/belum-dibaca', verifyToken, authorizeRole('admin', 'anggota'), getJumlahBelumDibaca);
router.put('/:id/baca', verifyToken, authorizeRole('admin', 'anggota'), tandaiDibaca);
router.put('/baca-semua', verifyToken, authorizeRole('admin', 'anggota'), tandaiSemuaDibaca);
router.delete('/:id', verifyToken, authorizeRole('admin', 'anggota'), hapusNotifikasi);
router.delete('/', verifyToken, authorizeRole('admin', 'anggota'), hapusSemuaNotifikasi);

module.exports = router;