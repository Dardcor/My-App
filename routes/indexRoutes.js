const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', (req, res) => {
    res.render('index', { error: null });
});

router.get('/list-ai', async (req, res) => { 
    try {
        console.log("Mengambil data AI dari Supabase..."); // Debugging 1

        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Debugging 2: Lihat hasilnya di Terminal VS Code
        console.log("Data ditemukan:", data); 
        console.log("Error ditemukan:", error);

        if (error) throw error;
        
        res.render('listai', { tools: data || [] }); 
    } catch (error) {
        console.error("Error Detail:", error.message);
        res.render('listai', { tools: [] }); 
    }
});

router.get('/jadwal-kuliah', (req, res) => {
    res.render('jadwalkuliah');
});

router.get('/list-tugas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tasks') 
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('listtugas', { tasks: data }); 
    } catch (error) {
        console.error(error.message);
        res.render('listtugas', { tasks: [] });
    }
});

module.exports = router;