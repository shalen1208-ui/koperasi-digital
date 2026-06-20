const db = require('../config/db');

// GET riwayat simpanan
const getRiwayatSimpanan = async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'admin') {
            [rows] = await db.query(`
        SELECT s.*, a.no_anggota, u.nama
        FROM simpanan s
        JOIN anggota a ON s.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY s.tanggal DESC
      `);
        } else {
            const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
            if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

            [rows] = await db.query(`
        SELECT s.*, a.no_anggota, u.nama
        FROM simpanan s
        JOIN anggota a ON s.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE s.anggota_id = ?
        ORDER BY s.tanggal DESC
      `, [anggota[0].id]);
        }
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// GET saldo
const getSaldo = async (req, res) => {
    try {
        const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
        if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

        const [result] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) AS saldo
      FROM simpanan WHERE anggota_id = ?
    `, [anggota[0].id]);

        res.json({ saldo: result[0].saldo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// POST setor
const setorSimpanan = async (req, res) => {
    try {
        const { jumlah, keterangan } = req.body;
        if (!jumlah || jumlah <= 0) return res.status(400).json({ message: 'Jumlah setor harus lebih dari 0.' });

        const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
        if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

        await db.query(
            'INSERT INTO simpanan (anggota_id, jenis, jumlah, keterangan) VALUES (?, "setor", ?, ?)',
            [anggota[0].id, jumlah, keterangan || 'Setor simpanan']
        );

        const io = req.app.get('io');
        io.to(`user_${req.user.id}`).emit('notifikasi', {
            pesan: `Setor simpanan sebesar Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil.`,
            tipe: 'simpanan'
        });

        await db.query(
            'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "simpanan")',
            [req.user.id, `Setor simpanan sebesar Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil.`]
        );

        res.status(201).json({ message: `Setor simpanan Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

// POST tarik
const tarikSimpanan = async (req, res) => {
    try {
        const { jumlah, keterangan } = req.body;
        if (!jumlah || jumlah <= 0) return res.status(400).json({ message: 'Jumlah tarik harus lebih dari 0.' });

        const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
        if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

        const [result] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) AS saldo
      FROM simpanan WHERE anggota_id = ?
    `, [anggota[0].id]);

        const saldo = parseFloat(result[0].saldo);
        if (jumlah > saldo) {
            return res.status(400).json({ message: `Saldo tidak cukup. Saldo Anda: Rp ${saldo.toLocaleString('id-ID')}` });
        }

        await db.query(
            'INSERT INTO simpanan (anggota_id, jenis, jumlah, keterangan) VALUES (?, "tarik", ?, ?)',
            [anggota[0].id, jumlah, keterangan || 'Tarik simpanan']
        );

        const io = req.app.get('io');
        io.to(`user_${req.user.id}`).emit('notifikasi', {
            pesan: `Tarik simpanan sebesar Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil.`,
            tipe: 'simpanan'
        });

        await db.query(
            'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "simpanan")',
            [req.user.id, `Tarik simpanan sebesar Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil.`]
        );

        res.status(201).json({ message: `Tarik simpanan Rp ${Number(jumlah).toLocaleString('id-ID')} berhasil!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { getRiwayatSimpanan, getSaldo, setorSimpanan, tarikSimpanan };