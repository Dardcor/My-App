const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const supabase = require('../config/supabase');
const { GoogleGenAI } = require("@google/genai"); 
const fs = require('fs'); 

// Menggunakan Environment Variable untuk kunci API Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY tidak ditemukan. Harap atur Environment Variable ini.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY }); 

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
});

function checkUserAuth(req, res, next) {
    if (req.session.userAccount) {
        next();
    } else {
        res.redirect('/user');
    }
}

function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType
        },
    };
}

const uploadMiddleware = upload.single('file_attachment'); 

// --- Auth Routes ---

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

router.get('/user-logout', (req, res) => {
    req.session.userAccount = null;
    req.session.chatHistory = null;
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
                password: hashedPassword,
                profile_image: null 
            }]);

        if (error) throw error;

        res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Gagal mendaftar: ' + err.message });
    }
});

// --- User Dashboard & Features Routes ---

router.get('/user/home', checkUserAuth, (req, res) => {
    res.render('user/home', { user: req.session.userAccount });
});

router.post('/user/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => {
    const { fullname, username, password, confirm_password } = req.body;
    const userId = req.session.userAccount.id;
    
    let updateData = {
        full_name: fullname,
        username: username
    };

    try {
        if (password && password.trim() !== "") {
            if (password !== confirm_password) {
                return res.render('user/profile', { user: req.session.userAccount, error: 'Konfirmasi password tidak cocok!' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        if (req.file) {
            const file = req.file;
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${userId}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file.buffer, { 
                    contentType: file.mimetype,
                    upsert: true 
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
            
            updateData.profile_image = publicUrlData.publicUrl;
        }

        const { data, error } = await supabase
            .from('public_users')
            .update(updateData)
            .eq('id', userId)
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            req.session.userAccount = data[0];
            res.render('user/profile', { user: data[0], success: 'Profil berhasil diperbarui!' });
        } else {
            throw new Error('Gagal mengupdate data user.');
        }

    } catch (err) {
        console.error("Update Error:", err.message);
        res.render('user/profile', { user: req.session.userAccount, error: 'Gagal memperbarui profil: ' + err.message });
    }
});

router.get('/user/profile', checkUserAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('public_users')
            .select('*')
            .eq('id', req.session.userAccount.id)
            .single();

        if(data) {
            req.session.userAccount = data;
            res.render('user/profile', { user: data });
        } else {
            res.render('user/profile', { user: req.session.userAccount });
        }
    } catch (err) {
        res.render('user/profile', { user: req.session.userAccount });
    }
});


router.get('/user/list-ai', checkUserAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_tools')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.render('user/listai', { tools: data, user: req.session.userAccount }); 
    } catch (error) {
        console.error(error.message);
        res.render('user/listai', { tools: [], user: req.session.userAccount }); 
    }
});

router.get('/user/jadwal-kuliah', checkUserAuth, (req, res) => {
    res.render('user/jadwalkuliah', { user: req.session.userAccount });
});

router.get('/user/list-tugas', checkUserAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tasks') 
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.render('user/listtugas', { tasks: data, user: req.session.userAccount }); 
    } catch (error) {
        console.error(error.message);
        res.render('user/listtugas', { tasks: [], user: req.session.userAccount });
    }
});

router.get('/user/dardcor-ai', checkUserAuth, (req, res) => {
    if (!req.session.chatHistory) {
        req.session.chatHistory = [];
    }
    
    res.render('user/dardcorai', { 
        user: req.session.userAccount,
        chatHistory: req.session.chatHistory 
    });
});

// --- UPDATED: Chat API Endpoint untuk Multimodal Semua File ---
router.post('/user/ai/chat', checkUserAuth, (req, res, next) => {
    uploadMiddleware(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err.message);
            return res.status(400).json({
                success: false,
                response: `Gagal mengunggah file. Detail: ${err.message}`
            });
        } else if (err) {
            console.error("Upload Error:", err.message);
            return res.status(400).json({
                success: false,
                response: `Gagal mengunggah file: ${err.message}`
            });
        }
        next();
    });
}, async (req, res) => {
    const message = req.body.message ? req.body.message.trim() : "";
    const uploadedFile = req.file; 

    if (!message && !uploadedFile) {
        return res.json({
            success: false,
            response: "Pesan atau file tidak boleh kosong."
        });
    }

    try {
        if (!req.session.chatHistory) {
            req.session.chatHistory = [];
        }

        const chat = ai.chats.create({
            model: "gemini-2.5-flash",
            history: req.session.chatHistory, 
            config: {
                systemInstruction: "Anda adalah asisten AI Dardcor yang ramah dan membantu, dirancang khusus untuk mahasiswa di Indonesia. Jawablah semua pertanyaan dengan singkat, jelas, dan relevan dengan topik akademik, tugas, atau jadwal kuliah. Jika Anda menerima file, berikan analisis atau jawaban terkait file tersebut. Selalu gunakan markdown untuk memformat teks, termasuk menggunakan code block (```) jika Anda memberikan contoh kode.",
            }
        });
        
        const parts = [];
        if (uploadedFile) {
            parts.push(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        }
        if (message) {
            parts.push({ text: message });
        } else if (uploadedFile) {
            parts.push({ text: "Tolong jelaskan atau analisis file ini." });
        }
        
        const response = await chat.sendMessage({ message: parts });

        const updatedHistory = await chat.getHistory();
        
        req.session.chatHistory = updatedHistory;

        res.json({
            success: true,
            response: response.text.trim()
        });
        
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        
        res.status(500).json({
            success: false,
            response: "Terjadi kesalahan saat memproses permintaan chat. Cek kunci API atau koneksi server."
        });
    }
});

module.exports = router;