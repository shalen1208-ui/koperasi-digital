const express = require('express');
const router = express.Router();
const { getAllAnggota, getAnggotaById, createAnggota, updateAnggota, deleteAnggota } = require('../controllers/anggotaController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/', verifyToken, authorizeRole('admin'), getAllAnggota);
router.get('/:id', verifyToken, authorizeRole('admin'), getAnggotaById);
router.post('/', verifyToken, authorizeRole('admin'), createAnggota);
router.put('/:id', verifyToken, authorizeRole('admin'), updateAnggota);
router.delete('/:id', verifyToken, authorizeRole('admin'), deleteAnggota);

module.exports = router;