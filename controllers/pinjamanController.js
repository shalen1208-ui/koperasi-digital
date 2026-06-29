const db = require('../config/db');

// Helper cek status anggota
const cekStatusAnggota = async (user_id) => {
  const db = require('../config/db');
  const [rows] = await db.query(
    'SELECT a.id, a.status FROM anggota a WHERE a.user_id = ?',
    [user_id]
  );
  if (rows.length === 0) return { error: 'Data anggota tidak ditemukan.' };
  if (rows[0].status === 'nonaktif') return { error: 'Akun Anda nonaktif. Hubungi admin.' };
  return { anggota_id: rows[0].id };
};



// Generate jadwal cicilan otomatis
const generateCicilan = async (pinjaman_id, jumlah, tenor, bunga) => {
  const cicilanPerBulan = (jumlah * (bunga / 100) * tenor + jumlah) / tenor;
  const today = new Date();

  for (let i = 1; i <= tenor; i++) {
    const jatuhTempo = new Date(today);
    jatuhTempo.setMonth(jatuhTempo.getMonth() + i);
    const tanggal = jatuhTempo.toISOString().split('T')[0];

    await db.query(
      'INSERT INTO cicilan (pinjaman_id, ke, jumlah, tanggal_jatuh_tempo, status) VALUES (?, ?, ?, ?, "belum_bayar")',
      [pinjaman_id, i, cicilanPerBulan.toFixed(2), tanggal]
    );
  }
};

// GET semua pinjaman (admin lihat semua, anggota lihat miliknya)
const getAllPinjaman = async (req, res) => {
  try {
    let rows;

    if (req.user.role === 'admin') {
      [rows] = await db.query(`
        SELECT p.*, a.no_anggota, u.nama,
               admin.nama as nama_admin
        FROM pinjaman p
        JOIN anggota a ON p.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        LEFT JOIN users admin ON p.diproses_oleh = admin.id
        ORDER BY p.tanggal_pengajuan DESC
      `);
    } else {
      const [anggota] = await db.query('SELECT id FROM anggota WHERE user_id = ?', [req.user.id]);
      if (anggota.length === 0) return res.status(404).json({ message: 'Data anggota tidak ditemukan.' });

      [rows] = await db.query(`
        SELECT p.*, a.no_anggota, u.nama,
               admin.nama as nama_admin
        FROM pinjaman p
        JOIN anggota a ON p.anggota_id = a.id
        JOIN users u ON a.user_id = u.id
        LEFT JOIN users admin ON p.diproses_oleh = admin.id
        WHERE p.anggota_id = ?
        ORDER BY p.tanggal_pengajuan DESC
      `, [anggota[0].id]);
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// GET detail pinjaman
const getPinjamanById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT p.*, a.no_anggota, u.nama
      FROM pinjaman p
      JOIN anggota a ON p.anggota_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Pinjaman tidak ditemukan.' });

    // Ambil juga cicilan-nya
    const [cicilan] = await db.query('SELECT * FROM cicilan WHERE pinjaman_id = ? ORDER BY ke ASC', [id]);

    res.json({ ...rows[0], cicilan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// POST ajukan pinjaman (anggota)
const ajukanPinjaman = async (req, res) => {
  try {
    const { jumlah, tenor, tujuan } = req.body;
    const bunga = 1.5; // bunga tetap 1.5% per bulan

    if (!jumlah || jumlah <= 0) return res.status(400).json({ message: 'Jumlah pinjaman harus lebih dari 0.' });
    if (!tenor || tenor <= 0) return res.status(400).json({ message: 'Tenor harus lebih dari 0.' });

    const cek = await cekStatusAnggota(req.user.id);
    if (cek.error) return res.status(403).json({ message: cek.error });
    const anggota = [{ id: cek.anggota_id }];

    // Cek apakah ada pinjaman aktif
    const [pinjamanAktif] = await db.query(
      'SELECT id FROM pinjaman WHERE anggota_id = ? AND status IN ("pending", "disetujui")',
      [anggota[0].id]
    );
    if (pinjamanAktif.length > 0) {
      return res.status(400).json({ message: 'Anda masih memiliki pinjaman aktif atau pending.' });
    }

    const [result] = await db.query(
      'INSERT INTO pinjaman (anggota_id, jumlah, tenor, bunga, tujuan, status) VALUES (?, ?, ?, ?, ?, "pending")',
      [anggota[0].id, jumlah, tenor, bunga, tujuan]
    );

    // Notifikasi ke admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "admin"');
    const io = req.app.get('io');

    for (const admin of admins) {
      await db.query(
        'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "pinjaman")',
        [admin.id, `Pengajuan pinjaman baru dari ${req.user.nama} sebesar Rp ${Number(jumlah).toLocaleString('id-ID')}.`]
      );
      io.to(`user_${admin.id}`).emit('notifikasi', {
        pesan: `Pengajuan pinjaman baru dari ${req.user.nama}.`,
        tipe: 'pinjaman'
      });
    }

    res.status(201).json({ message: 'Pengajuan pinjaman berhasil dikirim!', pinjaman_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// PUT setujui atau tolak pinjaman (admin)
const prosesPinjaman = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'disetujui' atau 'ditolak'

    if (!['disetujui', 'ditolak'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }

    const [pinjaman] = await db.query('SELECT * FROM pinjaman WHERE id = ?', [id]);
    if (pinjaman.length === 0) return res.status(404).json({ message: 'Pinjaman tidak ditemukan.' });
    if (pinjaman[0].status !== 'pending') {
      return res.status(400).json({ message: 'Pinjaman ini sudah diproses.' });
    }

    await db.query(
      'UPDATE pinjaman SET status = ?, tanggal_diproses = NOW(), diproses_oleh = ? WHERE id = ?',
      [status, req.user.id, id]
    );

    // Generate cicilan jika disetujui
    if (status === 'disetujui') {
      await generateCicilan(id, pinjaman[0].jumlah, pinjaman[0].tenor, pinjaman[0].bunga);
    }

    // Notifikasi ke anggota
    const [anggota] = await db.query(
      'SELECT a.user_id FROM anggota a WHERE a.id = ?',
      [pinjaman[0].anggota_id]
    );

    const pesanStatus = status === 'disetujui' ? 'disetujui' : 'ditolak';
    const io = req.app.get('io');

    await db.query(
      'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "pinjaman")',
      [anggota[0].user_id, `Pengajuan pinjaman Anda sebesar Rp ${Number(pinjaman[0].jumlah).toLocaleString('id-ID')} telah ${pesanStatus}.`]
    );

    io.to(`user_${anggota[0].user_id}`).emit('notifikasi', {
      pesan: `Pengajuan pinjaman Anda telah ${pesanStatus}.`,
      tipe: 'pinjaman'
    });

    res.json({ message: `Pinjaman berhasil ${pesanStatus}!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// GET simulasi kalkulator pinjaman
const simulasiPinjaman = async (req, res) => {
  try {
    const { jumlah, tenor } = req.query;
    const bunga = 1.5;

    if (!jumlah || !tenor) {
      return res.status(400).json({ message: 'Jumlah dan tenor wajib diisi.' });
    }

    const cicilanPerBulan = (jumlah * (bunga / 100) * tenor + Number(jumlah)) / tenor;
    const totalBayar = cicilanPerBulan * tenor;
    const totalBunga = totalBayar - jumlah;

    res.json({
      jumlah_pinjaman: Number(jumlah),
      tenor: Number(tenor),
      bunga_per_bulan: bunga,
      cicilan_per_bulan: parseFloat(cicilanPerBulan.toFixed(2)),
      total_bayar: parseFloat(totalBayar.toFixed(2)),
      total_bunga: parseFloat(totalBunga.toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = { getAllPinjaman, getPinjamanById, ajukanPinjaman, prosesPinjaman, simulasiPinjaman };