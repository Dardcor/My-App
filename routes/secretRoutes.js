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

    req.app.set('isMaintenance', newStatus);

    console.log(`Maintenance Mode switched to: ${newStatus}`);
    res.redirect('/secret/myserver');
});

// --------------------------------------------------------------------------------------------------
// MY WALLET (TELAH DIVERSIFIKASI UNTUK HANYA MENGGUNAKAN DEPOSIT & TRANSFER)
// --------------------------------------------------------------------------------------------------

router.get('/secret/mywallet', checkSecretAuth, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Inisialisasi hanya untuk tipe yang ADA di skema BARU
        const totals = { total_deposit: 0, total_transfer: 0 }; 
        
        // Memasukkan data lama ke tampilan (data lama tetap terbaca tapi tidak dihitung ke balance baru)
        let balance = 0; 

        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount) || 0;
            if (tx.type === 'deposit') {
                totals.total_deposit += amount;
                balance += amount;
            } else if (tx.type === 'transfer') {
                totals.total_transfer += amount;
                balance -= amount;
            } 
            // Untuk data lama (withdraw, payment, reward) masih bisa ditampilkan tapi tidak dihitung ke total deposit/transfer di sini.
            // Jika Anda ingin membersihkan data lama ini, jalankan query SQL penghapusan data lama di database Anda.
        });

        // Catatan: Jika Anda ingin mempertahankan tampilan "Total Keluar" (Total_Outflow) untuk data lama, 
        // Anda perlu menyesuaikan ulang logika perhitungan total, tetapi untuk menjaga kesederhanaan,
        // saat ini hanya menghitung balance dari 'deposit' dan 'transfer'.

        res.render('secret/mywallet', { balance, totals, transactions, user: req.session.secretUser });
    } catch (error) {
        console.error("Error Secret Wallet:", error.message);
        // Mengirimkan totals dengan nilai 0 untuk menghindari error di EJS
        res.render('secret/mywallet', { balance: 0, totals: { total_deposit: 0, total_transfer: 0 }, transactions: [], user: req.session.secretUser });
    }
});

router.post('/secret/bank/add', checkSecretAuth, async (req, res) => {
    try {
        // Hapus recipient dari destructuring
        const { amount, type, description } = req.body; 

        const newTransactionData = { 
            user_id: req.session.secretUser.username, 
            amount: parseFloat(amount) || 0, 
            type, 
            description,
            // Hapus field recipient dari objek yang akan di-insert
            // recipient: null 
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
        // Hapus recipient dari destructuring
        const { id, amount, type, description } = req.body; 
        
        const updateData = { 
            amount: parseFloat(amount) || 0, 
            type, 
            description,
            // Hapus field recipient dari objek yang akan di-update
            // recipient: null 
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