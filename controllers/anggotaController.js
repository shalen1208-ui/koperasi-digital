const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET semua anggota
const getAllAnggota = async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT u.id, u.nama, u.email, u.no_telepon, u.alamat,
             a.id as anggota_id, a.no_anggota, a.tanggal_bergabung, a.status,
             COALESCE(SUM(CASE WHEN s.jenis = 'setor' THEN s.jumlah ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN s.jenis = 'tarik' THEN s.jumlah ELSE 0 END), 0) AS saldo
      FROM users u
      JOIN anggota a ON u.id = a.user_id
      LEFT JOIN simpanan s ON a.id = s.anggota_id
      WHERE u.role = 'anggota'
      GROUP BY u.id, a.id
      ORDER BY a.no_anggota ASC
    `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// GET detail anggota
const getAnggotaById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
      SELECT u.id, u.nama, u.email, u.no_telepon, u.alamat,
             a.id as anggota_id, a.no_anggota, a.tanggal_bergabung, a.status,
             COALESCE(SUM(CASE WHEN s.jenis = 'setor' THEN s.jumlah ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN s.jenis = 'tarik' THEN s.jumlah ELSE 0 END), 0) AS saldo
      FROM users u
      JOIN anggota a ON u.id = a.user_id
      LEFT JOIN simpanan s ON a.id = s.anggota_id
      WHERE u.id = ? AND u.role = 'anggota'
      GROUP BY u.id, a.id
    `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Anggota tidak ditemukan.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// POST tambah anggota
const createAnggota = async (req, res) => {
    try {
        const { nama, email, password, no_telepon, alamat } = req.body;

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email sudah terdaftar.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (nama, email, password, role, no_telepon, alamat) VALUES (?, ?, ?, "anggota", ?, ?)',
            [nama, email, hashedPassword, no_telepon, alamat]
        );

        const userId = result.insertId;
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM anggota');
        const total = countResult[0].total + 1;
        const no_anggota = `KOP-${String(total).padStart(4, '0')}`;

        await db.query(
            'INSERT INTO anggota (user_id, no_anggota, tanggal_bergabung, status) VALUES (?, ?, CURDATE(), "aktif")',
            [userId, no_anggota]
        );

        res.status(201).json({ message: 'Anggota berhasil ditambahkan!', no_anggota });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// PUT update anggota
const updateAnggota = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, no_telepon, alamat, status } = req.body;

        await db.query(
            'UPDATE users SET nama = ?, no_telepon = ?, alamat = ? WHERE id = ?',
            [nama, no_telepon, alamat, id]
        );
        await db.query(
            'UPDATE anggota SET status = ? WHERE user_id = ?',
            [status, id]
        );

        res.json({ message: 'Data anggota berhasil diupdate!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// DELETE anggota
const deleteAnggota = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query('SELECT id FROM users WHERE id = ? AND role = "anggota"', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Anggota tidak ditemukan.' });
        }

        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Anggota berhasil dihapus!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { getAllAnggota, getAnggotaById, createAnggota, updateAnggota, deleteAnggota };