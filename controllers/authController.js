const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// REGISTER
const register = async (req, res) => {
  try {
    const { nama, email, password, no_telepon, alamat } = req.body;

    // Cek email sudah ada atau belum
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user baru
    const [result] = await db.query(
      'INSERT INTO users (nama, email, password, role, no_telepon, alamat) VALUES (?, ?, ?, "anggota", ?, ?)',
      [nama, email, hashedPassword, no_telepon, alamat]
    );

    const userId = result.insertId;

    // Generate no anggota otomatis: KOP-0001, KOP-0002, dst
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM anggota');
    const total = countResult[0].total + 1;
    const no_anggota = `KOP-${String(total).padStart(4, '0')}`;

    // Simpan ke tabel anggota
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

    // Cek user ada atau tidak
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Email atau password salah.' });
    }

    const user = users[0];

    // Cek password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email atau password salah.' });
    }

    // Generate JWT
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

// GET PROFIL (user yang sedang login)
const getProfil = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT u.id, u.nama, u.email, u.role, u.no_telepon, u.alamat, a.no_anggota, a.tanggal_bergabung, a.status FROM users u LEFT JOIN anggota a ON u.id = a.user_id WHERE u.id = ?',
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



// GANTI PASSWORD
const gantiPassword = async (req, res) => {
  try {
    const { password_lama, password_baru } = req.body;

    if (!password_lama || !password_baru) {
      return res.status(400).json({ message: 'Password lama dan password baru wajib diisi.' });
    }

    if (password_baru.length < 6) {
      return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
    }

    // Ambil data user
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const user = users[0];

    // Cek password lama
    const isMatch = await bcrypt.compare(password_lama, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Password lama tidak sesuai.' });

    // Hash password baru
    const hashedPassword = await bcrypt.hash(password_baru, 10);

    // Update password
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Password berhasil diubah!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = { register, login, getProfil, gantiPassword };

// LUPA PASSWORD - Kirim email reset
const lupaPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email wajib diisi.' });

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Jangan kasih tau email tidak terdaftar (security)
      return res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });
    }

    const user = users[0];

    // Generate token random
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    // Hapus token lama
    await db.query('DELETE FROM reset_token WHERE user_id = ?', [user.id]);

    // Simpan token baru
    await db.query(
      'INSERT INTO reset_token (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    // Kirim email
    const transporter = require('../config/mailer');
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Koperasi Digital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Password - Koperasi Digital',
      html: `
        <div style="font-family:'Poppins',sans-serif;max-width:500px;margin:0 auto;padding:2rem;background:#f0f4f8;border-radius:16px;">
          <div style="background:linear-gradient(135deg,#1a6b3c,#2d9e5f);border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem;">
            <h2 style="color:white;margin:0;font-size:1.5rem;">🏦 Koperasi Digital</h2>
          </div>
          <div style="background:white;border-radius:12px;padding:1.5rem;">
            <h3 style="color:#1a1a2e;margin-bottom:1rem;">Reset Password</h3>
            <p style="color:#666;margin-bottom:1rem;">Halo <strong>${user.nama}</strong>,</p>
            <p style="color:#666;margin-bottom:1.5rem;">Kami menerima permintaan reset password untuk akun Anda. Klik tombol di bawah untuk membuat password baru:</p>
            <div style="text-align:center;margin:1.5rem 0;">
              <a href="${resetUrl}" style="background:linear-gradient(135deg,#1a6b3c,#2d9e5f);color:white;padding:0.75rem 2rem;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a>
            </div>
            <p style="color:#999;font-size:0.8rem;margin-top:1.5rem;">Link ini akan kadaluarsa dalam <strong>1 jam</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</p>
          </div>
        </div>
      `
    });

    res.json({ message: 'Link reset password telah dikirim ke email Anda.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengirim email. Coba lagi nanti.' });
  }
};

// RESET PASSWORD - Proses reset
const resetPassword = async (req, res) => {
  try {
    const { token, password_baru } = req.body;

    if (!token || !password_baru) {
      return res.status(400).json({ message: 'Token dan password baru wajib diisi.' });
    }

    if (password_baru.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });
    }

    // Cek token valid
    const [tokens] = await db.query(
      'SELECT * FROM reset_token WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
    }

    const resetData = tokens[0];

    // Hash password baru
    const hashedPassword = await bcrypt.hash(password_baru, 10);

    // Update password
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetData.user_id]);

    // Tandai token sudah digunakan
    await db.query('UPDATE reset_token SET used = TRUE WHERE id = ?', [resetData.id]);

    res.json({ message: 'Password berhasil direset! Silakan login dengan password baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// Cek token valid
const cekToken = async (req, res) => {
  try {
    const { token } = req.query;
    const [tokens] = await db.query(
      'SELECT * FROM reset_token WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    if (tokens.length === 0) {
      return res.status(400).json({ valid: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
    }
    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Terjadi kesalahan server.' });
  }
};



// REQUEST BANTUAN RESET PASSWORD (kirim notifikasi ke admin)
const requestBantuanPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email wajib diisi.' });

    // Cek user ada atau tidak
    const [users] = await db.query('SELECT id, nama FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Tetap response sukses agar tidak bocorkan info
      return res.json({ message: 'Admin akan segera menghubungi Anda.' });
    }

    const user = users[0];

    // Kirim notifikasi ke semua admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "admin"');
    const io = req.app.get('io');

    for (const admin of admins) {
      await db.query(
        'INSERT INTO notifikasi (user_id, pesan, tipe) VALUES (?, ?, "umum")',
        [admin.id, `⚠️ Pengguna ${user.nama} (${email}) meminta bantuan reset password.`]
      );
      io.to(`user_${admin.id}`).emit('notifikasi', {
        pesan: `⚠️ ${user.nama} meminta bantuan reset password!`,
        tipe: 'umum'
      });
    }

    res.json({ message: 'Admin akan segera menghubungi Anda.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};



// UPDATE PROFIL (anggota update sendiri)
const updateProfil = async (req, res) => {
  try {
    const { nama, no_telepon, alamat } = req.body;
    if (!nama) return res.status(400).json({ message: 'Nama tidak boleh kosong.' });

    await db.query(
      'UPDATE users SET nama = ?, no_telepon = ?, alamat = ? WHERE id = ?',
      [nama, no_telepon, alamat, req.user.id]
    );

    res.json({ message: 'Profil berhasil diupdate!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = { register, login, getProfil, gantiPassword, lupaPassword, resetPassword, cekToken, requestBantuanPassword, updateProfil };