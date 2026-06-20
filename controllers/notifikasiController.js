const db = require('../config/db');

// GET semua notifikasi
const getNotifikasi = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM notifikasi WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// GET jumlah belum dibaca
const getJumlahBelumDibaca = async (req, res) => {
    try {
        const [result] = await db.query(
            'SELECT COUNT(*) as jumlah FROM notifikasi WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );
        res.json({ jumlah: result[0].jumlah });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// PUT tandai satu dibaca
const tandaiDibaca = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE notifikasi SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        res.json({ message: 'Notifikasi ditandai sudah dibaca.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// PUT tandai semua dibaca
const tandaiSemuaDibaca = async (req, res) => {
    try {
        await db.query(
            'UPDATE notifikasi SET is_read = TRUE WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ message: 'Semua notifikasi ditandai sudah dibaca.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// DELETE hapus satu
const hapusNotifikasi = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            'DELETE FROM notifikasi WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        res.json({ message: 'Notifikasi berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// DELETE hapus semua
const hapusSemuaNotifikasi = async (req, res) => {
    try {
        await db.query('DELETE FROM notifikasi WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'Semua notifikasi berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { getNotifikasi, getJumlahBelumDibaca, tandaiDibaca, tandaiSemuaDibaca, hapusNotifikasi, hapusSemuaNotifikasi };