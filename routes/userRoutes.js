const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/user', (req, res) => {
    if (req.session.userAccount) {
        return res.redirect('/user/home');
    }
    res.render('user', { error: null });
});

router.post('/user-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase
            .from('public_users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            return res.render('user', { error: 'Username tidak ditemukan!' });
        }

        if (password === data.password) {
            req.session.userAccount = data;
            res.redirect('/user/home');
        } else {
            res.render('user', { error: 'Password salah!' });
        }
    } catch (err) {
        res.render('user', { error: 'Terjadi kesalahan server.' });
    }
});

router.get('/user/home', (req, res) => {
    if (!req.session.userAccount) {
        return res.redirect('/user');
    }
    res.render('user/home', { user: req.session.userAccount });
});

router.get('/user-logout', (req, res) => {
    req.session.userAccount = null;
    res.redirect('/user');
});

router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    const { fullname, username, password } = req.body;
    try {
        const { data: existingUser } = await supabase
            .from('public_users')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.render('register', { error: 'Username sudah digunakan!' });
        }

        const { error } = await supabase
            .from('public_users')
            .insert([{ full_name: fullname, username, password }]);

        if (error) throw error;

        res.redirect('/user'); 
    } catch (err) {
        res.render('register', { error: 'Gagal mendaftar: ' + err.message });
    }
});

module.exports = router;