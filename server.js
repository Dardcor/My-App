// Memuat Environment Variables dari file .env (wajib jika menggunakan .env secara lokal)
// Pastikan Anda telah menginstal 'dotenv': npm install dotenv
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

// Ambil session secret dari Environment Variable
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET tidak ditemukan. Harap atur Environment Variable ini.");
}

// Set Global Variable untuk Status Maintenance (Default: False)
app.set('isMaintenance', false);

// Import Routes
const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const secretRoutes = require('./routes/secretRoutes');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'image')));

// --- Konfigurasi Session yang Diperbaiki ---
app.use(session({
    secret: SESSION_SECRET, // Menggunakan Environment Variable
    resave: false,
    saveUninitialized: true,
    // Jika di-deploy di HTTPS (Vercel, dll.), gunakan konfigurasi ini:
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true di production (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // 24 jam
    },
    // Wajib jika di-deploy di belakang proxy (Vercel) dan 'secure: true'
    proxy: true 
}));

// --- Middleware Cek Maintenance ---
app.use((req, res, next) => {
    const isMaintenance = req.app.get('isMaintenance');
    
    // Daftar URL yang BOLEH diakses saat maintenance (Admin & Secret)
    const allowedPrefixes = ['/secret', '/admin', '/login', '/logout', '/secret-login', '/user-login'];
    
    // Jika Maintenance AKTIF dan user bukan mengakses halaman allowed
    if (isMaintenance && !allowedPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return res.render('maintenance');
    }
    
    next();
});

// Gunakan Routes
app.use('/', secretRoutes); // Prioritas untuk handle toggle maintenance
app.use('/', indexRoutes);
app.use('/', userRoutes);
app.use('/', adminRoutes);

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});