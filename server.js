require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET tidak ditemukan. Harap atur Environment Variable ini.");
}

app.set('isMaintenance', false);

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
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 
    },
    proxy: true 
}));

app.use((req, res, next) => {
    const isMaintenance = req.app.get('isMaintenance');
    
    const allowedPrefixes = ['/secret', '/admin', '/login', '/logout', '/secret-login', '/user-login'];
    
    if (isMaintenance && !allowedPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return res.render('maintenance');
    }
    
    next();
});

app.use('/', secretRoutes);
app.use('/', indexRoutes);
app.use('/', userRoutes);
app.use('/', adminRoutes);

app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

const server = app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});

server.keepAliveTimeout = 600000;
server.headersTimeout = 610000;
server.timeout = 600000;