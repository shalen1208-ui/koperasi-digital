const db = require('../config/db');

// Helper cek status anggota
const cekStatusAnggota = async (user_id) => {
  const [rows] = await db.query(
    'SELECT a.id, a.status FROM anggota a WHERE a.user_id = ?',
    [user_id]
  );
  if (rows.length === 0) return { error: 'Data anggota tidak ditemukan.' };
  if (rows[0].status === 'nonaktif') return { error: 'Akun Anda nonaktif. Hubungi admin.' };
  return { anggota_id: rows[0].id };
};



// GET semua cicilan (admin lihat semua, anggota lihat miliknya)
const getAllCicilan = async (req, res) => {
  try {
    let rows;

    if (req.user.role === 'admin') {
      [rows] = await db.query(`
        SELECT c.*, p.jumlah as jumlah_pinjaman, p.tenor,
               a.no_anggota, u.nama
        FROM cicilan c
        JOIN pinjaman p ON c.pinjaman_id = p.id
        JOIN anggota a ON p.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY c.tanggal_jatuh_tempo ASC
      `);
    } else {
      const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
      if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

      [rows] = await db.query(`
        SELECT c.*, p.jumlah as jumlah_pinjaman, p.tenor,
               a.no_anggota, u.nama
        FROM cicilan c
        JOIN pinjaman p ON c.pinjaman_id = p.id
        JOIN anggota a ON p.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        WHERE p.anggota_id = ?
        ORDER BY c.tanggal_jatuh_tempo ASC
      `, [anggota[0].id]);
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// GET cicilan berdasarkan pinjaman_id
const getCicilanByPinjaman = async (req, res) => {
  try {
    const { pinjaman_id } = req.params;

    const [rows] = await db.query(`
      SELECT c.*, p.jumlah as jumlah_pinjaman, p.tenor, p.bunga,
             a.no_anggota, u.nama
      FROM cicilan c
      JOIN pinjaman p ON c.pinjaman_id = p.id
      JOIN anggota a ON p.anggota_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE c.pinjaman_id = ?
      ORDER BY c.ke ASC
    `, [pinjaman_id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Cicilan tidak ditemukan.' });

    // Hitung ringkasan
    const totalCicilan = rows.reduce((sum, c) => sum + parseFloat(c.jumlah), 0);
    const totalLunas = rows.filter(c => c.status === 'lunas').reduce((sum, c) => sum + parseFloat(c.jumlah), 0);
    const sisaTagihan = totalCicilan - totalLunas;

    res.json({
      cicilan: rows,
      ringkasan: {
        total_cicilan: parseFloat(totalCicilan.toFixed(2)),
        total_lunas: parseFloat(totalLunas.toFixed(2)),
        sisa_tagihan: parseFloat(sisaTagihan.toFixed(2))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// POST bayar cicilan (anggota)
const bayarCicilan = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek status anggota
    if (req.user.role === 'anggota') {
      const cek = await cekStatusAnggota(req.user.id);
      if (cek.error) return res.status(403).json({ message: cek.error });
    }

    const [cicilan] = await db.query(`
      SELECT c.*, p.anggota_id, p.id as pinjaman_id, p.tenor
      FROM cicilan c
      JOIN pinjaman p ON c.pinjaman_id = p.id
      WHERE c.id = ?
    `, [id]);

    if (cicilan.length === 0) return res.status(404).json({ message: 'Cicilan tidak ditemukan.' });
    if (cicilan[0].status === 'lunas') return res.status(400).json({ message: 'Cicilan ini sudah lunas.' });

    // Pastikan anggota hanya bisa bayar cicilannya sendiri
    if (req.user.role === 'anggota') {
      const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
      if (anggota[0].id !== cicilan[0].anggota_id) {
        return res.status(403).json({ message: 'Akses ditolak.' });
      }
    }

    // Update status cicilan
    await db.query(
      'UPDATE cicilan SET status = "lunas", tanggal_bayar = NOW() WHERE id = ?',
      [id]
    );

    // Cek apakah semua cicilan sudah lunas
    const [sisaCicilan] = await db.query(
      'SELECT COUNT(*) as sisa FROM cicilan WHERE pinjaman_id = ? AND status != "lunas"',
      [cicilan[0].pinjaman_id]
    );

    if (sisaCicilan[0].sisa === 0) {
      // Update status pinjaman jadi lunas
      await db.query('UPDATE pinjaman SET status = "lunas" WHERE id = ?', [cicilan[0].pinjaman_id]);

      // Notifikasi lunas
      const io = req.app.get('io');
      await db.query(
        'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "cicilan")',
        [req.user.id, 'Selamat! Semua cicilan pinjaman Anda telah lunas.']
      );
      io.to(`user_${req.user.id}`).emit('notifikasi', {
        pesan: 'Selamat! Semua cicilan pinjaman Anda telah lunas.',
        tipe: 'cicilan'
      });
    } else {
      // Notifikasi bayar cicilan
      const io = req.app.get('io');
      await db.query(
        'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "cicilan")',
        [req.user.id, `Pembayaran cicilan ke-${cicilan[0].ke} sebesar Rp ${Number(cicilan[0].jumlah).toLocaleString('id-ID')} berhasil.`]
      );
      io.to(`user_${req.user.id}`).emit('notifikasi', {
        pesan: `Pembayaran cicilan ke-${cicilan[0].ke} berhasil.`,
        tipe: 'cicilan'
      });
    }

    res.json({ message: `Cicilan ke-${cicilan[0].ke} berhasil dibayar!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// UPDATE status cicilan yang terlambat (cron job manual)
const updateStatusTerlambat = async (req, res) => {
  try {
    const [result] = await db.query(`
      UPDATE cicilan 
      SET status = 'terlambat' 
      WHERE status = 'belum_bayar' 
      AND tanggal_jatuh_tempo < CURDATE()
    `);

    res.json({ message: `${result.affectedRows} cicilan diupdate menjadi terlambat.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = { getAllCicilan, getCicilanByPinjaman, bayarCicilan, updateStatusTerlambat };