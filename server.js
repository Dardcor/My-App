const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); 
const session = require('express-session'); 
const multer = require('multer'); 
const discordWebhook = require('./views/admin/discord.js'); 

const app = express(); 
const port = process.env.PORT || 3000;

const supabaseUrl = 'https://rvguyovrjffvnwlmksrh.supabase.co'; 
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

const userId = 'Dardcor'; 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
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

function checkAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/admin');
    }
}

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

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin/home');
        }
        res.clearCookie('connect.sid'); 
        res.redirect('/admin'); 
    });
});

app.get('/', (req, res) => {
    res.render('index', { error: null });
});

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

app.get('/jadwal-kuliah', (req, res) => {
    res.render('jadwalkuliah');
});

app.get('/list-tugas', (req, res) => {
    res.render('listtugas');
});

app.get('/admin/home', checkAuth, (req, res) => {
    res.render('admin/home'); 
});

app.get('/admin/upload-ai', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.render('admin/uplistai', { tools: data }); 
    } catch (error) {
        console.error("Error mengambil AI tools:", error.message);
        res.render('admin/uplistai', { tools: [] }); 
    }
});

app.post('/admin/upload-ai', checkAuth, upload.single('image_file'), async (req, res) => {
    try {
        const { name, website_link, image_url_manual } = req.body;
        let final_image_url = image_url_manual; 

        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('ai_logos') 
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype
                });

            if (uploadError) {
                throw uploadError;
            }

            const { data: publicUrlData } = supabase.storage
                .from('ai_logos')
                .getPublicUrl(fileName);
            
            final_image_url = publicUrlData.publicUrl;
        }

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

app.post('/admin/delete-ai', checkAuth, async (req, res) => {
    try {
        const { id, image_url } = req.body;

        const { error: dbError } = await supabase
            .from('ai_tools')
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;

        if (image_url.includes(supabaseUrl)) { 
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

app.post('/bank/add', checkAuth, async (req, res) => {
    try {
        const { amount, type, description, recipient } = req.body;
        const newTransactionData = { user_id: userId, amount: parseFloat(amount) || 0, type: type, description: description, recipient: (type === 'transfer' || type === 'payment') ? (recipient || null) : null };
        const { data, error } = await supabase.from('transactions').insert([newTransactionData]).select().single();
        if (error) throw error;
        
        await discordWebhook.sendPaymentLog('add', data);
        
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
        
        const { data: oldTxData, error: findError } = await supabase.from('transactions').select('description, amount').eq('id', id).eq('user_id', userId).single();
        if (findError && findError.code !== 'PGRST116') throw findError;
        
        const { data: updatedTx, error: updateError } = await supabase.from('transactions').update(updateData).eq('id', id).eq('user_id', userId).select().single();
        if (updateError) throw updateError;
        
        if (oldTxData && updatedTx) {
             await discordWebhook.sendPaymentLog('edit', updatedTx, oldTxData);
        }
        
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
        
        if (deletedTx) {
            await discordWebhook.sendPaymentLog('delete', deletedTx);
        }
        
        res.redirect('/admin/mywallet'); 
    } catch (error) {
        console.error("Error di rute POST /bank/delete:", error.message);
        res.status(500).send(`Gagal menghapus transaksi: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
    discordWebhook.startHealthyReminder();
    discordWebhook.startPrayerReminder();
});