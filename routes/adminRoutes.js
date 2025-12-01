const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function checkAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/admin');
    }
}

router.get('/admin', (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect('/admin/home');
    }
    res.render('admin', { error: undefined });
});

router.post('/admin', async (req, res) => {
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
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
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

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.redirect('/admin/home');
        res.clearCookie('connect.sid'); 
        res.redirect('/admin'); 
    });
});

router.get('/admin/home', checkAuth, (req, res) => {
    res.render('admin/home'); 
});

router.get('/admin/status', checkAuth, (req, res) => {
    res.render('admin/status', { logs: [] }); 
});

router.get('/admin/upload-ai', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.render('admin/uplistai', { tools: data }); 
    } catch (error) {
        res.render('admin/uplistai', { tools: [] }); 
    }
});

router.post('/admin/upload-ai', checkAuth, upload.single('image_file'), async (req, res) => {
    try {
        const { name, website_link, image_url_manual } = req.body;
        let final_image_url = image_url_manual; 

        if (req.file) {
            const file = req.file;
            const fileName = `${Date.now()}-${file.originalname}`;
            const { error: uploadError } = await supabase.storage
                .from('ai_logos') 
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('ai_logos')
                .getPublicUrl(fileName);
            
            final_image_url = publicUrlData.publicUrl;
        }

        const { error } = await supabase
            .from('ai_tools')
            .insert([{ name: name, image_url: final_image_url, website_link: website_link }]);

        if (error) throw error;
        res.redirect('/admin/upload-ai');
    } catch (error) {
        res.status(500).send(`Gagal menyimpan data: ${error.message}`);
    }
});

router.post('/admin/delete-ai', checkAuth, async (req, res) => {
    try {
        const { id, image_url } = req.body;
        const { error: dbError } = await supabase.from('ai_tools').delete().eq('id', id);
        if (dbError) throw dbError;

        if (image_url && image_url.includes('supabase')) { 
            const fileName = image_url.split('/').pop();
            if (fileName) {
                await supabase.storage.from('ai_logos').remove([fileName]);
            }
        }
        res.redirect('/admin/upload-ai');
    } catch (error) {
        res.status(500).send(`Gagal menghapus data: ${error.message}`);
    }
});

router.get('/admin/upload-jadwal', checkAuth, (req, res) => {
    res.render('admin/upjadwal'); 
});

router.get('/admin/upload-tugas', checkAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.render('admin/uptugas', { tasks: data || [] });
    } catch (error) {
        res.render('admin/uptugas', { tasks: [] });
    }
});

router.post('/admin/upload-tugas', checkAuth, async (req, res) => {
    try {
        const { mata_kuliah, minggu, deadline, hari, deskripsi } = req.body;
        const { error } = await supabase.from('tasks').insert([{
            mata_kuliah, minggu: parseInt(minggu), deadline: deadline || null, hari, deskripsi
        }]);
        if (error) throw error;
        res.redirect('/admin/upload-tugas');
    } catch (error) {
        res.status(500).send(`Gagal upload tugas: ${error.message}`);
    }
});

router.post('/admin/delete-tugas', checkAuth, async (req, res) => {
    try {
        const { id } = req.body;
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        res.redirect('/admin/upload-tugas');
    } catch (error) {
        res.status(500).send("Gagal menghapus tugas.");
    }
});

module.exports = router;