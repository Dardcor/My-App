// Import modul
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); // Import Supabase
const session = require('express-session'); // Import express-session

const app = express();
const port = process.env.PORT || 3000;

// --- PENGATURAN SUPABASE ---
const supabaseUrl = 'https://rvguyovrjffvnwlmksrh.supabase.co'; // <-- URL ANDA
// (Saya perbaiki tanda kutip yang hilang di akhir key Anda)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z3V5b3ZyamZmdm53bG1rc3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzU0NTQsImV4cCI6MjA3ODc1MTQ1NH0.FArgD97TNr1XJb8EgQRHWnP7gM08aJbEpW7Md2lbjfA';

const actualSupabaseUrl = process.env.SUPABASE_URL || supabaseUrl;
const actualSupabaseKey = process.env.SUPABASE_KEY || supabaseKey;

let supabase;
try {
    supabase = createClient(actualSupabaseUrl, actualSupabaseKey);
    if (!actualSupabaseUrl || !actualSupabaseUrl.startsWith('http')) {
        throw new Error('Supabase URL tidak valid atau belum diatur.');
    }
     if (!actualSupabaseKey || actualSupabaseKey.length < 50) {
        throw new Error('Supabase Key tidak valid atau belum diatur.');
    }
} catch (error) {
    console.error("Kesalahan Inisialisasi Supabase:", error.message);
    process.exit(1);
}

// --- PENGATURAN LAIN ---
const userId = 'bank_utama'; // ID pengguna statis
// Pengaturan Discord Webhook telah dihapus

// Middleware
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- PENGATURAN SESSION ---
app.use(session({
    secret: 'RAHASIA_INI_HARUS_DIganti_NANTI_YA!', 
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set ke 'true' jika Anda menggunakan HTTPS (production)
        maxAge: 1000 * 60 * 60 * 24 // Cookie berlaku selama 1 hari
    } 
}));

// --- Middleware Proteksi ---
function checkAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/admin');
    }
}

// --- RUTE UNTUK LOGIN ADMIN ---

app.get('/admin', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/admin/home');
    }
    res.render('admin', { error: undefined });
});

app.post('/admin', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('password') 
            .eq('username', username)
            .single(); 

        if (error || !data) {
            const errorMessage = 'Username atau password salah!';
            return res.render('admin', { error: errorMessage });
        }

        if (password === data.password) {
            req.session.isLoggedIn = true; 
            req.session.username = username; 
            res.redirect('/admin/home');
        } else {
            const errorMessage = 'Username atau password salah!';
            res.render('admin', { error: errorMessage });
        }

    } catch (err) {
        console.error('Error saat login:', err.message);
        res.render('admin', { error: 'Terjadi kesalahan server.' });
    }
});

// --- RUTE LOGOUT ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/home');
        }
        res.clearCookie('connect.sid'); 
        res.redirect('/admin'); 
    });
});

// --- ROUTES PUBLIK ---

// Rute Utama (GET /)
app.get('/', (req, res) => {
    res.render('index', { error: null });
});

// Rute untuk List AI
app.get('/list-ai', (req, res) => {
    res.render('listai'); 
});

// Rute untuk Jadwal Kuliah
app.get('/jadwal-kuliah', (req, res) => {
    res.render('jadwalkuliah');
});

// Rute untuk List Tugas
app.get('/list-tugas', (req, res) => {
    res.render('listtugas');
});

// --- RUTE ADMIN YANG DIPROTEKSI ---

// Rute 'admin/home' yang diproteksi
app.get('/admin/home', checkAuth, (req, res) => {
    res.render('admin/home'); // Merender 'views/admin/home.ejs'
});

// Rute untuk Upload AI
app.get('/admin/upload-ai', checkAuth, (req, res) => {
    res.render('admin/uplistai'); // Merender views/admin/uplistai.ejs
});

// Rute untuk Upload Jadwal
app.get('/admin/upload-jadwal', checkAuth, (req, res) => {
    res.render('admin/upjadwal'); // Merender views/admin/upjadwal.ejs
});

// Rute untuk Upload Tugas
app.get('/admin/upload-tugas', checkAuth, (req, res) => {
    res.render('admin/uptugas'); // Merender views/admin/uptugas.ejs
});

// Rute '/admin/mywallet'
app.get('/admin/mywallet', checkAuth, async (req, res) => {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
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

        // Render file 'views/admin/mywallet.ejs'
        res.render('admin/mywallet', { balance, totals, transactions });

    } catch (error) {
        console.error("Error di rute GET /admin/mywallet:", error.message);
        res.status(500).send(`Terjadi kesalahan server: ${error.message}`);
    }
});

// Rute API Bank (POST) - DIPROTEKSI
app.post('/bank/add', checkAuth, async (req, res) => {
    try {
        const { amount, type, description, recipient } = req.body;
        const newTransactionData = { user_id: userId, amount: parseFloat(amount) || 0, type: type, description: description, recipient: (type === 'transfer' || type === 'payment') ? (recipient || null) : null };
        const { data, error } = await supabase.from('transactions').insert([newTransactionData]).select().single();
        if (error) throw error;
        
        // Log Discord dihapus
        
        res.redirect('/admin/mywallet'); // Arahkan kembali ke mywallet
    } catch (error) {
        console.error("Error di rute POST /bank/add:", error.message);
        res.status(500).send(`Gagal menambah transaksi: ${error.message}`);
    }
});

app.post('/bank/edit', checkAuth, async (req, res) => {
    try {
        const { id, amount, type, description, recipient } = req.body;
        if (!id) return res.status(400).send("ID Transaksi dibutuhkan");
        const updateData = { amount: parseFloat(amount) || 0, type: type, description: description, recipient: (type === 'transfer' || type === 'payment') ? (recipient || null) : null };
        const { data: oldTxData, error: findError } = await supabase.from('transactions').select('description, amount').eq('id', id).eq('user_id', userId).single();
        if (findError && findError.code !== 'PGRST116') throw findError;
        
        const { data: updatedTx, error: updateError } = await supabase.from('transactions').update(updateData).eq('id', id).eq('user_id', userId).select().single();
        if (updateError) throw updateError;
        
        // Log Discord dihapus
        
        res.redirect('/admin/mywallet'); // Arahkan kembali ke mywallet
    } catch (error) {
        console.error("Error di rute POST /bank/edit:", error.message);
        res.status(500).send(`Gagal mengedit transaksi: ${error.details || error.message}`);
    }
});

app.post('/bank/delete', checkAuth, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).send("ID Transaksi dibutuhkan");
        const { data: deletedTx, error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId).select().single();
        if (error && error.code !== 'PGRST116') throw error;
        
        // Log Discord dihapus
        
        res.redirect('/admin/mywallet'); // Arahkan kembali ke mywallet
    } catch (error) {
        console.error("Error di rute POST /bank/delete:", error.message);
        res.status(500).send(`Gagal menghapus transaksi: ${error.message}`);
    }
});

// --- FUNGSI DISCORD (Async) ---
// Fungsi sendToDiscord telah dihapus

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});