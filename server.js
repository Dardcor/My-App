const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

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

app.use(session({
    secret: 'RAHASIA_INI_HARUS_DIganti_NANTI_YA!', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } 
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