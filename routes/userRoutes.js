const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
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

        const match = await bcrypt.compare(password, data.password);

        if (match) {
            req.session.userAccount = data;
            res.redirect('/user/home');
        } else {
            res.render('user', { error: 'Password salah!' });
        }
    } catch (err) {
        console.error(err);
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
    const { fullname, username, email, password } = req.body;
    
    try {
        const { data: userCheck } = await supabase
            .from('public_users')
            .select('username')
            .eq('username', username)
            .single();

        if (userCheck) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan!' });
        }

        const { data: emailCheck } = await supabase
            .from('public_users')
            .select('email')
            .eq('email', email)
            .single();

        if (emailCheck) {
            return res.status(400).json({ success: false, message: 'Email sudah terdaftar!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { error } = await supabase
            .from('public_users')
            .insert([{ 
                full_name: fullname, 
                username: username, 
                email: email,
                password: hashedPassword 
            }]);

        if (error) throw error;

        res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Gagal mendaftar: ' + err.message });
    }
});

module.exports = router;