const db = require('../config/db');

const getStatistikAdmin = async (req, res) => {
    try {
        const [totalAnggota] = await db.query('SELECT COUNT(*) as total FROM anggota WHERE status = "aktif"');
        const [totalSimpanan] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) AS total
      FROM simpanan
    `);
        const [totalPinjaman] = await db.query('SELECT COALESCE(SUM(jumlah), 0) as total FROM pinjaman WHERE status = "disetujui"');
        const [totalPending] = await db.query('SELECT COUNT(*) as total FROM pinjaman WHERE status = "pending"');
        const [totalTerlambat] = await db.query('SELECT COUNT(*) as total FROM cicilan WHERE status = "terlambat"');

        const [grafikSimpanan] = await db.query(`
      SELECT DATE_FORMAT(tanggal, '%b %Y') as bulan,
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) as setor,
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) as tarik
      FROM simpanan
      WHERE tanggal >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m'), DATE_FORMAT(tanggal, '%b %Y')
      ORDER BY DATE_FORMAT(tanggal, '%Y-%m') ASC
    `);

        const [grafikPinjaman] = await db.query('SELECT status, COUNT(*) as total FROM pinjaman GROUP BY status');

        const [anggotaTerbaru] = await db.query(`
      SELECT u.nama, u.email, a.no_anggota, a.tanggal_bergabung, a.status
      FROM users u JOIN anggota a ON u.id = a.user_id
      ORDER BY a.tanggal_bergabung DESC LIMIT 5
    `);

        const [pinjamanTerbaru] = await db.query(`
      SELECT p.id, p.jumlah, p.tenor, p.status, p.tanggal_pengajuan, u.nama, a.no_anggota
      FROM pinjaman p
      JOIN anggota a ON p.anggota_id = a.id
      JOIN users u ON a.user_id = u.id
      ORDER BY p.tanggal_pengajuan DESC LIMIT 5
    `);

        res.json({
            statistik: {
                total_anggota: totalAnggota[0].total,
                total_simpanan: totalSimpanan[0].total,
                total_pinjaman: totalPinjaman[0].total,
                total_pending: totalPending[0].total,
                total_terlambat: totalTerlambat[0].total
            },
            grafik_simpanan: grafikSimpanan,
            grafik_pinjaman: grafikPinjaman,
            anggota_terbaru: anggotaTerbaru,
            pinjaman_terbaru: pinjamanTerbaru
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

const getStatistikAnggota = async (req, res) => {
    try {
        const [anggota] = await db.query(
            'SELECT a.id, a.no_anggota, a.tanggal_bergabung FROM anggota a WHERE a.user_id = ?',
            [req.user.id]
        );
        if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

        const anggota_id = anggota[0].id;

        const [saldo] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) AS saldo
      FROM simpanan WHERE anggota_id = ?
    `, [anggota_id]);

        const [pinjamanAktif] = await db.query(
            'SELECT * FROM pinjaman WHERE anggota_id = ? AND status = "disetujui" LIMIT 1',
            [anggota_id]
        );

        const [cicilanBelumBayar] = await db.query(`
      SELECT c.* FROM cicilan c
      JOIN pinjaman p ON c.pinjaman_id = p.id
      WHERE p.anggota_id = ? AND c.status != 'lunas'
      ORDER BY c.tanggal_jatuh_tempo ASC LIMIT 3
    `, [anggota_id]);

        const [riwayatSimpanan] = await db.query(
            'SELECT * FROM simpanan WHERE anggota_id = ? ORDER BY tanggal DESC LIMIT 5',
            [anggota_id]
        );

        const [grafikSimpanan] = await db.query(`
      SELECT DATE_FORMAT(tanggal, '%b %Y') as bulan,
        COALESCE(SUM(CASE WHEN jenis = 'setor' THEN jumlah ELSE 0 END), 0) as setor,
        COALESCE(SUM(CASE WHEN jenis = 'tarik' THEN jumlah ELSE 0 END), 0) as tarik
      FROM simpanan
      WHERE anggota_id = ? AND tanggal >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(tanggal, '%Y-%m'), DATE_FORMAT(tanggal, '%b %Y')
      ORDER BY DATE_FORMAT(tanggal, '%Y-%m') ASC
    `, [anggota_id]);

        res.json({
            anggota: anggota[0],
            saldo: saldo[0].saldo,
            pinjaman_aktif: pinjamanAktif[0] || null,
            cicilan_belum_bayar: cicilanBelumBayar,
            riwayat_simpanan: riwayatSimpanan,
            grafik_simpanan: grafikSimpanan
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { getStatistikAdmin, getStatistikAnggota };