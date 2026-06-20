const express = require('express');
const router = express.Router();
const { getRiwayatSimpanan, getSaldo, setorSimpanan, tarikSimpanan } = require('../controllers/simpananController');
const verifyToken = require('../middleware/auth');
const authorizeRole = require('../middleware/role');

router.get('/', verifyToken, authorizeRole('admin', 'anggota'), getRiwayatSimpanan);
router.get('/saldo', verifyToken, authorizeRole('anggota'), getSaldo);
router.post('/setor', verifyToken, authorizeRole('anggota'), setorSimpanan);
router.post('/tarik', verifyToken, authorizeRole('anggota'), tarikSimpanan);

module.exports = router;