const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

// Import Routes
const indexRoutes = require('./routes/indexRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const secretRoutes = require('./routes/secretRoutes'); // File baru

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'image')));

app.use(session({
    secret: 'RAHASIA_INI_HARUS_DIganti_NANTI_YA!', 
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        maxAge: 1000 * 60 * 60 * 24 
    } 
}));

// Gunakan Routes
app.use('/', indexRoutes);
app.use('/', userRoutes);
app.use('/', adminRoutes);
app.use('/', secretRoutes); // Daftarkan route secret

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});