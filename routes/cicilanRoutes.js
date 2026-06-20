const express = require('express');
const router = express.Router();
const { getAllCicilan, getCicilanByPinjaman, bayarCicilan, updateStatusTerlambat } = require('../controllers/cicilanController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/', verifyToken, authorizeRole('admin', 'anggota'), getAllCicilan);
router.get('/pinjaman/:pinjaman_id', verifyToken, authorizeRole('admin', 'anggota'), getCicilanByPinjaman);
router.post('/:id/bayar', verifyToken, authorizeRole('anggota'), bayarCicilan);
router.put('/update-terlambat', verifyToken, authorizeRole('admin'), updateStatusTerlambat);

module.exports = router;