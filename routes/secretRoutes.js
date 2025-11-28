const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Middleware
function checkSecretAuth(req, res, next) {
    if (req.session.isSecretLoggedIn) {
        next();
    } else {
        res.redirect('/secret');
    }
}

// --- Login & Logout ---
router.get('/secret', (req, res) => {
    if (req.session.isSecretLoggedIn) {
        return res.redirect('/secret/home');
    }
    res.render('secret', { error: null });
});

router.post('/secret-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase
            .from('secret_users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            return res.render('secret', { error: 'Identitas tidak dikenali.' });
        }

        if (password === data.password) {
            req.session.isSecretLoggedIn = true;
            req.session.secretUser = data;
            res.redirect('/secret/home');
        } else {
            res.render('secret', { error: 'Kode akses salah.' });
        }
    } catch (err) {
        console.error(err);
        res.render('secret', { error: 'Sistem terkunci sementara.' });
    }
});

router.get('/secret-logout', (req, res) => {
    req.session.isSecretLoggedIn = false;
    req.session.secretUser = null;
    res.redirect('/secret');
});

// --- Dashboard & Features ---

router.get('/secret/home', checkSecretAuth, (req, res) => {
    res.render('secret/home', { user: req.session.secretUser });
});

// MY SERVER CONTROL
router.get('/secret/myserver', checkSecretAuth, async (req, res) => {
    try {
        // Ambil status maintenance dari DB (Table: settings)
        // Kita asumsikan ada tabel 'settings' dengan kolom 'key' dan 'value'
        // Jika belum ada, kita pakai default dari global variable di server.js (via req.app.get)
        
        // Untuk simplifikasi, kita baca dari global app setting
        const isMaintenance = req.app.get('isMaintenance') || false;

        res.render('secret/myserver', { user: req.session.secretUser, isMaintenance });
    } catch (error) {
        console.error(error);
        res.render('secret/myserver', { user: req.session.secretUser, isMaintenance: false });
    }
});

router.post('/secret/maintenance/toggle', checkSecretAuth, (req, res) => {
    const currentStatus = req.app.get('isMaintenance') || false;
    const newStatus = !currentStatus;
    
    // Update global app setting
    req.app.set('isMaintenance', newStatus);
    
    console.log(`Maintenance Mode switched to: ${newStatus}`);
    res.redirect('/secret/myserver');
});

// MY WALLET
router.get('/secret/mywallet', checkSecretAuth, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const totals = { total_deposit: 0, total_withdraw: 0, total_transfer: 0, total_payment: 0, total_reward: 0 };
        
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            switch (tx.type) {
                case 'deposit': totals.total_deposit += amount; break;
                case 'withdraw': totals.total_withdraw += amount; break;
                case 'transfer': totals.total_transfer += amount; break;
                case 'payment': totals.total_payment += amount; break;
                case 'reward': totals.total_reward += amount; break;
            }
        });

        const balance = (totals.total_deposit || 0) - (totals.total_withdraw || 0) - (totals.total_transfer || 0) - (totals.total_payment || 0) + (totals.total_reward || 0);

        res.render('secret/mywallet', { balance, totals, transactions, user: req.session.secretUser });
    } catch (error) {
        console.error("Error Secret Wallet:", error.message);
        res.render('secret/mywallet', { balance: 0, totals: {}, transactions: [], user: req.session.secretUser });
    }
});

router.post('/secret/bank/add', checkSecretAuth, async (req, res) => {
    try {
        const { amount, type, description, recipient } = req.body;
        const newTransactionData = { 
            user_id: req.session.secretUser.username, 
            amount: parseFloat(amount) || 0, 
            type, description, 
            recipient: (type === 'transfer' || type === 'payment') ? (recipient || null) : null 
        };
        const { error } = await supabase.from('transactions').insert([newTransactionData]);
        if (error) throw error;
        res.redirect('/secret/mywallet'); 
    } catch (error) {
        console.error("Error add transaction:", error);
        res.status(500).send("Gagal menambah transaksi.");
    }
});

router.post('/secret/bank/edit', checkSecretAuth, async (req, res) => {
    try {
        const { id, amount, type, description, recipient } = req.body;
        const updateData = { 
            amount: parseFloat(amount) || 0, 
            type, description, 
            recipient: (type === 'transfer' || type === 'payment') ? (recipient || null) : null 
        };
        const { error } = await supabase.from('transactions').update(updateData).eq('id', id);
        if (error) throw error;
        res.redirect('/secret/mywallet'); 
    } catch (error) {
        console.error("Error edit transaction:", error);
        res.status(500).send("Gagal mengedit transaksi.");
    }
});

router.post('/secret/bank/delete', checkSecretAuth, async (req, res) => {
    try {
        const { id } = req.body;
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        res.redirect('/secret/mywallet'); 
    } catch (error) {
        console.error("Error delete transaction:", error);
        res.status(500).send("Gagal menghapus transaksi.");
    }
});

module.exports = router;