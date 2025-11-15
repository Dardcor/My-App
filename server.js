// Import modul
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); 
const session = require('express-session'); 
const multer = require('multer'); // Import multer

const app = express(); // <-- Baris ini penting
const port = process.env.PORT || 3000;

// --- PENGATURAN SUPABASE ---
const supabaseUrl = 'https://rvguyovrjffvnwlmksrh.supabase.co'; // <-- URL ANDA
// [PERHATIAN] Ganti dengan SERVICE_ROLE KEY Anda yang rahasia
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z3V5b3ZyamZmdm53bG1rc3JoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE3NTQ1NCwiZXhwIjoyMDc4NzUxNDU0fQ.1fVEvegSpYP6PAyqBAocmD3v0cUAbQ_LxQxQXyPfcY4';

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

// Pengaturan Multer (menyimpan file di memori sementara)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// [BARU] Ini membuat folder 'image' menjadi publik
app.use(express.static(path.join(__dirname, 'image')));

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
            return res.render('admin', { error: 'Username atau password salah!' });
        }
        if (password === data.password) {
            req.session.isLoggedIn = true; 
            req.session.username = username; 
            res.redirect('/admin/home');
        } else {
            res.render('admin', { error: 'Username atau password salah!' });
        }
    } catch (err) {
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

// Rute List AI (Mengambil data dari Supabase)
app.get('/list-ai', async (req, res) => { 
    try {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.render('listai', { tools: data }); 
    } catch (error) {
        console.error("Error saat mengambil list AI:", error.message);
        res.render('listai', { tools: [] }); 
    }
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

// Rute untuk Upload AI (GET - menampilkan form)
app.get('/admin/upload-ai', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.render('admin/uplistai', { tools: data }); // Kirim data 'tools' ke EJS
    } catch (error) {
        console.error("Error mengambil AI tools:", error.message);
        res.render('admin/uplistai', { tools: [] }); // Kirim array kosong jika error
    }
});

// Rute untuk Upload AI (POST - menyimpan data)
app.post('/admin/upload-ai', checkAuth, upload.single('image_file'), async (req, res) => {
    try {
        const { name, website_link, image_url_manual } = req.body;
        let final_image_url = image_url_manual; // Ambil link manual

        // Jika ada file yang diupload (req.file), file ini jadi prioritas
        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname}`;
            
            // Upload ke Supabase Storage di bucket 'ai_logos'
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('ai_logos') // Nama Bucket Anda
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (uploadError) {
                throw uploadError;
            }

            // Dapatkan URL publik dari file yang baru diupload
            const { data: publicUrlData } = supabase.storage
                .from('ai_logos')
                .getPublicUrl(fileName);
            
            final_image_url = publicUrlData.publicUrl;
        }

        // Simpan data ke database 'ai_tools'
        const { data, error } = await supabase
            .from('ai_tools')
            .insert([
                { name: name, image_url: final_image_url, website_link: website_link }
            ]);

        if (error) {
            throw error;
        }

        res.redirect('/admin/upload-ai');

    } catch (error) {
        console.error("Error saat upload AI:", error.message);
        res.status(500).send(`Gagal menyimpan data: ${error.message}`);
    }
});

// Rute untuk Menghapus AI
app.post('/admin/delete-ai', checkAuth, async (req, res) => {
    try {
        const { id, image_url } = req.body;

        // 1. Hapus data dari database
        const { error: dbError } = await supabase
            .from('ai_tools')
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;

        // 2. Hapus file dari Supabase Storage (jika itu file storage)
        // Cek apakah URL-nya adalah URL storage kita
        if (image_url.includes(supabaseUrl)) { 
            // Ekstrak nama file dari URL
            const fileName = image_url.split('/ai_logos/')[1];
            if (fileName) {
                await supabase.storage
                    .from('ai_logos')
                    .remove([fileName]);
            }
        }

        res.redirect('/admin/upload-ai');

    } catch (error) {
        console.error("Error saat menghapus AI:", error.message);
        res.status(500).send(`Gagal menghapus data: ${error.message}`);
    }
});


// Rute admin lainnya
app.get('/admin/upload-jadwal', checkAuth, (req, res) => {
    res.render('admin/upjadwal'); 
});
app.get('/admin/upload-tugas', checkAuth, (req, res) => {
    res.render('admin/uptugas'); 
});
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
        res.redirect('/admin/mywallet'); 
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
        const { data: updatedTx, error: updateError } = await supabase.from('transactions').update(updateData).eq('id', id).eq('user_id', userId).select().single();
        if (updateError) throw updateError;
        res.redirect('/admin/mywallet'); 
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
        res.redirect('/admin/mywallet'); 
    } catch (error) {
        console.error("Error di rute POST /bank/delete:", error.message);
        res.status(500).send(`Gagal menghapus transaksi: ${error.message}`);
    }
});

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});