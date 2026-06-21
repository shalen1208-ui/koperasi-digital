const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simpan io agar bisa diakses di controller
app.set('io', io);

// Routes
const authRoutes = require('./routes/authRoutes');
const anggotaRoutes = require('./routes/anggotaRoutes');
const simpananRoutes = require('./routes/simpananRoutes');
const pinjamanRoutes = require('./routes/pinjamanRoutes');
const cicilanRoutes = require('./routes/cicilanRoutes');
const notifikasiRoutes = require('./routes/notifikasiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/anggota', anggotaRoutes);
app.use('/api/simpanan', simpananRoutes);
app.use('/api/pinjaman', pinjamanRoutes);
app.use('/api/cicilan', cicilanRoutes);
app.use('/api/notifikasi', notifikasiRoutes);

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/auth/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views/auth/register.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/dashboard.html')));
app.get('/admin/anggota', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/anggota.html')));
app.get('/admin/pinjaman', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/pinjaman.html')));
app.get('/admin/laporan', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/laporan.html')));
app.get('/anggota/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views/anggota/dashboard.html')));
app.get('/anggota/simpanan', (req, res) => res.sendFile(path.join(__dirname, 'views/anggota/simpanan.html')));
app.get('/anggota/pinjaman', (req, res) => res.sendFile(path.join(__dirname, 'views/anggota/pinjaman.html')));
app.get('/anggota/cicilan', (req, res) => res.sendFile(path.join(__dirname, 'views/anggota/cicilan.html')));

const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

// Socket.io connection
io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on('disconnect', () => {
        console.log('User terputus:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});