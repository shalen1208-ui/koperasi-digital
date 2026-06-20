const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// REGISTER
const register = async (req, res) => {
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

        res.status(201).json({ message: 'Registrasi berhasil!', no_anggota });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email atau password salah.' });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email atau password salah.' });
        }

        const token = jwt.sign(
            { id: user.id, nama: user.nama, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login berhasil!',
            token,
            user: {
                id: user.id,
                nama: user.nama,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// GET PROFIL
const getProfil = async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT u.id, u.nama, u.email, u.role, u.no_telepon, u.alamat, 
      a.no_anggota, a.tanggal_bergabung, a.status 
      FROM users u 
      LEFT JOIN anggota a ON u.id = a.user_id 
      WHERE u.id = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        res.json(users[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { register, login, getProfil };