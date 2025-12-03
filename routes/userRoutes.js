const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const supabase = require('../config/supabase');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { v4: uuidv4 } = require('uuid');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY tidak ditemukan.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const uploadMiddleware = upload.single('file_attachment');

router.get('/user', (req, res) => { if (req.session.userAccount) return res.redirect('/user/home'); res.render('user', { error: null }); });

router.post('/user-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase.from('public_users').select('*').eq('username', username).single();
        if (error || !data) return res.render('user', { error: 'Username tidak ditemukan!' });
        const match = await bcrypt.compare(password, data.password);
        if (match) { req.session.cookie.maxAge = 24 * 60 * 60 * 1000; req.session.userAccount = data; res.redirect('/user/home'); }
        else { res.render('user', { error: 'Password salah!' }); }
    } catch (err) { console.error(err); res.render('user', { error: 'Terjadi kesalahan server.' }); }
});

router.get('/user-logout', (req, res) => { req.session.userAccount = null; req.session.chatHistory = null; req.session.currentConversationId = null; res.redirect('/user'); });

router.get('/register', (req, res) => { res.render('register', { error: null }); });

router.post('/register', async (req, res) => {
    const { fullname, username, email, password } = req.body;
    try {
        const { data: userCheck } = await supabase.from('public_users').select('username').eq('username', username).single();
        if (userCheck) return res.status(400).json({ success: false, message: 'Username sudah digunakan!' });
        const { data: emailCheck } = await supabase.from('public_users').select('email').eq('email', email).single();
        if (emailCheck) return res.status(400).json({ success: false, message: 'Email sudah terdaftar!' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('public_users').insert([{ full_name: fullname, username: username, email: email, password: hashedPassword, profile_image: null }]);
        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Gagal mendaftar: ' + err.message }); }
});

router.get('/user/home', checkUserAuth, (req, res) => { res.render('user/home', { user: req.session.userAccount }); });

router.post('/user/profile/update', checkUserAuth, upload.single('profile_image'), async (req, res) => {
    const { fullname, username, password, confirm_password } = req.body;
    const userId = req.session.userAccount.id;
    let updateData = { full_name: fullname, username: username };
    try {
        if (password && password.trim() !== "") {
            if (password !== confirm_password) return res.render('user/profile', { user: req.session.userAccount, error: 'Konfirmasi password tidak cocok!' });
            updateData.password = await bcrypt.hash(password, 10);
        }
        if (req.file) {
            const fileName = `${userId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            updateData.profile_image = publicUrlData.publicUrl;
        }
        const { data, error } = await supabase.from('public_users').update(updateData).eq('id', userId).select();
        if (error) throw error;
        req.session.userAccount = data[0];
        res.render('user/profile', { user: data[0], success: 'Profil berhasil diperbarui!' });
    } catch (err) { res.render('user/profile', { user: req.session.userAccount, error: 'Gagal update: ' + err.message }); }
});

router.get('/user/profile', checkUserAuth, async (req, res) => {
    try { const { data } = await supabase.from('public_users').select('*').eq('id', req.session.userAccount.id).single(); if(data) req.session.userAccount = data; res.render('user/profile', { user: req.session.userAccount }); } catch (err) { res.render('user/profile', { user: req.session.userAccount }); }
});

router.get('/user/list-ai', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('ai_tools').select('*').order('created_at', { ascending: false }); res.render('user/listai', { tools: data || [], user: req.session.userAccount }); } catch (error) { res.render('user/listai', { tools: [], user: req.session.userAccount }); } });

router.get('/user/jadwal-kuliah', checkUserAuth, (req, res) => { res.render('user/jadwalkuliah', { user: req.session.userAccount }); });

router.get('/user/list-tugas', checkUserAuth, async (req, res) => { try { const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }); res.render('user/listtugas', { tasks: data || [], user: req.session.userAccount }); } catch (error) { res.render('user/listtugas', { tasks: [], user: req.session.userAccount }); } });

router.post('/user/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    const newConversationId = uuidv4();
    res.json({ success: true, redirectUrl: `/user/dardcor-ai/${newConversationId}` });
});

router.post('/user/ai/rename-chat', checkUserAuth, async (req, res) => {
    const { conversationId, newTitle } = req.body;
    const userId = req.session.userAccount.id;
    try {
        const { error } = await supabase.from('chat_history').update({ message: newTitle }).eq('conversation_id', conversationId).eq('user_id', userId).eq('role', 'user').order('created_at', { ascending: true }).limit(1);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengubah nama chat' }); }
});

router.post('/user/ai/delete-chat-history', checkUserAuth, async (req, res) => {
    const { conversationId } = req.body;
    const userId = req.session.userAccount.id;
    try {
        const { error } = await supabase.from('chat_history').delete().eq('conversation_id', conversationId).eq('user_id', userId);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menghapus chat' }); }
});

router.get('/user/dardcor-ai/:conversationId', checkUserAuth, loadChatHandler);
router.get('/user/dardcor-ai', checkUserAuth, loadChatHandler);

async function loadChatHandler(req, res) {
    const userId = req.session.userAccount.id;
    const requestedConversationId = req.params.conversationId;
    
    try {
        const { data: dbHistory, error } = await supabase.from('chat_history').select('conversation_id, role, message, created_at, file_metadata').eq('user_id', userId).order('created_at', { ascending: true });
        if (error) throw error;

        let activeConversationId = req.session.currentConversationId;
        
        if (requestedConversationId) {
            activeConversationId = requestedConversationId;
            req.session.currentConversationId = activeConversationId;
        } else if (!activeConversationId && dbHistory && dbHistory.length > 0) {
            const sortedHistory = [...dbHistory].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            activeConversationId = sortedHistory[0].conversation_id;
            req.session.currentConversationId = activeConversationId;
        }

        let activeChatHistory = [];
        if (activeConversationId && dbHistory) {
            activeChatHistory = dbHistory.filter(item => item.conversation_id === activeConversationId);
        }

        const uniqueConversationsMap = new Map();
        if (dbHistory) {
            const reversedDbHistory = [...dbHistory].reverse(); 
            for (const item of reversedDbHistory) {
                if (!uniqueConversationsMap.has(item.conversation_id)) {
                    uniqueConversationsMap.set(item.conversation_id, item);
                }
            }
        }

        res.render('user/dardcorai', {
            user: req.session.userAccount,
            chatHistory: activeChatHistory,
            fullHistory: Array.from(uniqueConversationsMap.values()),
            activeConversationId: activeConversationId,
            escapeHtml: escapeHtml
        });
    } catch (err) {
        console.error("History Error:", err.message);
        res.render('user/dardcorai', { 
            user: req.session.userAccount, 
            chatHistory: [], 
            fullHistory: [], 
            activeConversationId: null, 
            error: "Gagal memuat chat.", 
            escapeHtml: escapeHtml 
        });
    }
}

router.post('/user/ai/chat', checkUserAuth, (req, res, next) => {
    req.setTimeout(600000);
    uploadMiddleware(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: `Gagal upload: ${err.message}` });
        next();
    });
}, async (req, res) => {
    const message = req.body.message ? req.body.message.trim() : "";
    const uploadedFile = req.file;
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || req.session.currentConversationId;

    if (!conversationId) {
        conversationId = uuidv4();
        req.session.currentConversationId = conversationId;
    }
    if (!message && !uploadedFile) return res.json({ success: false, response: "Pesan kosong." });

    try {
        const { error: insertError } = await supabase.from('chat_history').insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'user',
            message: message || "File terlampir",
            file_metadata: uploadedFile ? { filename: uploadedFile.originalname, size: uploadedFile.size } : null
        });
        
        if (insertError) throw insertError;

        const { data: dbHistory } = await supabase.from('chat_history').select('role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });

        let historyForGemini = [];
        if (dbHistory && dbHistory.length > 0) {
            const previousMessages = dbHistory.slice(0, -1);
            let mergedMessages = [];
            
            for (const msg of previousMessages) {
                const role = msg.role === 'bot' ? 'model' : 'user';
                if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === role) {
                    mergedMessages[mergedMessages.length - 1].parts[0].text += "\n" + msg.message;
                } else {
                    mergedMessages.push({ role: role, parts: [{ text: msg.message }] });
                }
            }
            historyForGemini = mergedMessages;
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: `
                Kamu adalah Dardcor AI, asisten coding expert.
                
                INSTRUKSI:
                1. Jika user meminta kode (HTML, CSS, JS, Python, dll), JANGAN PERNAH merender outputnya secara visual.
                2. Kamu WAJIB membungkus SEMUA kode di dalam Markdown Code Block (\`\`\`bahasa ... \`\`\`).
                3. Pastikan kamu selalu memberikan baris baru sebelum membuka blok kode.
                4. Jangan pernah menulis tag HTML seperti <div> atau <h1> di luar blok kode.
            `,
            safetySettings: safetySettings
        });

        const chat = model.startChat({ history: historyForGemini });
        
        const parts = [];
        if (uploadedFile) {
            parts.push(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        }
        if (message) {
            parts.push({ text: message });
        } else if (uploadedFile) {
            parts.push({ text: "Analisis file ini." });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;
        const botResponseText = response.text();

        const { error: saveError } = await supabase.from('chat_history').insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'bot',
            message: botResponseText
        });

        if (saveError) throw new Error("Gagal menyimpan respons AI.");

        res.json({ success: true, response: botResponseText, conversationId: conversationId });

    } catch (error) {
        console.error("API ERROR:", error);
        let errorMsg = "Terjadi kesalahan pada server AI.";
        if (error.message.includes('429')) errorMsg = "⚠️ Kuota AI habis. Tunggu sebentar.";
        else if (error.message.includes('503')) errorMsg = "⚠️ Server overload.";
        else if (error.message.includes('SAFETY')) errorMsg = "⚠️ Konten diblokir oleh filter keamanan.";
        res.status(500).json({ success: false, response: errorMsg });
    }
});

module.exports = router;