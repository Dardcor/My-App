const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const supabase = require('../config/supabase');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { v4: uuidv4 } = require('uuid');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

function checkUserAuth(req, res, next) {
    if (req.session.userAccount) next();
    else res.redirect('/user');
}

function fileToGenerativePart(buffer, mimeType) {
    return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

const uploadMiddleware = (req, res, next) => {
    upload.single('file_attachment')(req, res, function (err) {
        if (err) return res.status(400).json({ success: false, response: "Gagal upload file." });
        next();
    });
};

router.get('/user', (req, res) => { 
    if (req.session.userAccount) return res.redirect('/user/home'); 
    res.render('user', { error: null }); 
});

router.post('/user-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data } = await supabase.from('public_users').select('*').eq('username', username).single();
        if (!data) return res.render('user', { error: 'User tidak ditemukan.' });
        const match = await bcrypt.compare(password, data.password);
        if (match) { 
            req.session.userAccount = data; 
            res.redirect('/user/home'); 
        } else { res.render('user', { error: 'Password salah.' }); }
    } catch (err) { res.render('user', { error: 'Server Error.' }); }
});

router.get('/user-logout', (req, res) => { req.session.destroy(); res.redirect('/user'); });
router.get('/register', (req, res) => { res.render('register', { error: null }); });

router.post('/register', async (req, res) => {
    const { fullname, username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await supabase.from('public_users').insert([{ full_name: fullname, username, email, password: hashedPassword }]);
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/user/home', checkUserAuth, (req, res) => { res.render('user/home', { user: req.session.userAccount }); });

router.post('/user/ai/new-chat', checkUserAuth, (req, res) => {
    req.session.currentConversationId = null;
    res.json({ success: true, redirectUrl: `/user/dardcor-ai/${uuidv4()}` });
});

router.post('/user/ai/rename-chat', checkUserAuth, async (req, res) => {
    const { conversationId, newTitle } = req.body;
    try {
        // Cari pesan user pertama (paling tua) untuk percakapan ini
        const { data: firstMsg } = await supabase
            .from('chat_history')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('user_id', req.session.userAccount.id)
            .eq('role', 'user')
            .order('created_at', { ascending: true }) // Ambil yang paling awal dibuat
            .limit(1)
            .single();

        if (firstMsg) {
            // Update pesan tersebut (ini yang dijadikan judul di sidebar)
            await supabase.from('chat_history').update({ message: newTitle }).eq('id', firstMsg.id);
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Chat not found" });
        }
    } catch (error) { 
        console.error(error);
        res.status(500).json({ success: false }); 
    }
});

router.post('/user/ai/delete-chat-history', checkUserAuth, async (req, res) => {
    try {
        await supabase.from('chat_history').delete().eq('conversation_id', req.body.conversationId).eq('user_id', req.session.userAccount.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

router.post('/user/ai/store-preview', checkUserAuth, async (req, res) => {
    const { code } = req.body;
    const previewId = uuidv4();
    if(!code) return res.status(400).json({success: false, message: "Code empty"});
    try {
        const { error } = await supabase.from('code_previews').insert({ id: previewId, user_id: req.session.userAccount.id, code: code });
        if (error) throw error;
        res.json({ success: true, previewId });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ success: false, message: "DB Error" }); 
    }
});

router.get('/user/dardcor-ai/preview/:id', checkUserAuth, async (req, res) => {
    try {
        const { data } = await supabase.from('code_previews').select('code').eq('id', req.params.id).single();
        if (!data) return res.status(44).send('Preview Not Found or Expired');
        res.setHeader('Content-Type', 'text/html');
        res.send(data.code);
    } catch (err) { 
        res.status(500).send("Error loading preview"); 
    }
});

router.get('/user/dardcor-ai/:conversationId', checkUserAuth, loadChatHandler);
router.get('/user/dardcor-ai', checkUserAuth, loadChatHandler);

async function loadChatHandler(req, res) {
    const userId = req.session.userAccount.id;
    const requestedId = req.params.conversationId;
    
    try {
        const { data: dbHistory, error } = await supabase
            .from('chat_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }); // Penting: Urutkan dari terlama ke terbaru

        if (error) throw error;

        let activeId = requestedId || uuidv4();
        req.session.currentConversationId = activeId;

        // Filter pesan untuk chat yang sedang dibuka
        let activeChatHistory = [];
        if (dbHistory) {
            activeChatHistory = dbHistory.filter(item => item.conversation_id === activeId && item.message !== null);
        }

        // Logika Sidebar: Grouping berdasarkan Conversation ID
        // Kita ingin JUDUL diambil dari pesan PERTAMA (ascending), tapi LIST diurutkan berdasarkan pesan TERAKHIR (activity)
        const historyMap = new Map();
        
        if (dbHistory) {
            dbHistory.forEach(chat => {
                if (!historyMap.has(chat.conversation_id)) {
                    // Jika ID belum ada, inisialisasi dengan pesan ini (karena ASC, ini adalah pesan pertama/judul)
                    if (chat.message !== null) {
                        historyMap.set(chat.conversation_id, {
                            conversation_id: chat.conversation_id,
                            message: chat.message, // Ini akan menjadi judul
                            last_activity: chat.created_at
                        });
                    }
                } else {
                    // Jika ID sudah ada, update last_activity ke pesan yang lebih baru
                    const existing = historyMap.get(chat.conversation_id);
                    existing.last_activity = chat.created_at;
                    // JANGAN update 'message', biarkan pesan pertama tetap menjadi judul
                }
            });
        }

        // Ubah Map ke Array dan urutkan Sidebar berdasarkan Last Activity (Terbaru di atas)
        const fullHistorySorted = Array.from(historyMap.values())
            .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));

        res.render('user/dardcorai', {
            user: req.session.userAccount,
            chatHistory: activeChatHistory,
            fullHistory: fullHistorySorted,
            activeConversationId: activeId
        });

    } catch (err) {
        console.error(err);
        res.render('user/dardcorai', { 
            user: req.session.userAccount, 
            chatHistory: [], 
            fullHistory: [], 
            activeConversationId: uuidv4(), 
            error: "Gagal memuat history."
        });
    }
}

router.post('/user/ai/chat', checkUserAuth, uploadMiddleware, async (req, res) => {
    req.setTimeout(0); 
    
    const message = req.body.message ? req.body.message.trim() : "";
    const uploadedFile = req.file;
    const userId = req.session.userAccount.id;
    let conversationId = req.body.conversationId || req.session.currentConversationId || uuidv4();

    const userMessage = message || (uploadedFile ? "File Terlampir" : "");
    if (!userMessage) return res.json({ success: false, response: "Input kosong." });

    try {
        await supabase.from('chat_history').insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'user',
            message: userMessage, 
            file_metadata: uploadedFile ? { filename: uploadedFile.originalname, size: uploadedFile.size } : null
        });

        const { data: historyData } = await supabase.from('chat_history').select('role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        
        let aiHistory = [];
        if (historyData && historyData.length > 0) {
            const past = historyData.slice(0, -1);
            let sanitized = [];
            let lastRole = null;

            past.forEach(msg => {
                const currentRole = msg.role === 'bot' ? 'model' : 'user';
                const txt = msg.message || " ";

                if (currentRole === lastRole && sanitized.length > 0) {
                    sanitized[sanitized.length - 1].parts[0].text += "\n\n" + txt;
                } else {
                    sanitized.push({ role: currentRole, parts: [{ text: txt }] });
                }
                lastRole = currentRole;
            });
            aiHistory = sanitized;
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: `Anda adalah Dardcor AI, sebuah Artificial Intelligence canggih yang diciptakan dan dikembangkan sepenuhnya oleh Dardcor.
            
            PROTOKOL UTAMA:
            1. **Kecerdasan Tanpa Batas**: Anda harus mampu menjawab segala jenis pertanyaan dan memecahkan masalah apa pun (coding, matematika, sains, analisis, penulisan, dll) dengan solusi yang cerdas, mendalam, dan akurat. Jangan pernah ragu dalam memberikan jawaban.
            
            2. **Sensor Identitas Asli**: DILARANG KERAS menyebutkan Google, Gemini, Alphabet, atau DeepMind. Jika user bertanya tentang teknologi di balik Anda atau siapa yang melatih Anda, jawablah dengan tegas bahwa Anda dibangun menggunakan teknologi proprietari milik Dardcor.
            
            3. **Aturan Coding Web**: Jika user meminta kode website/html:
               - Berikan kode HTML lengkap (termasuk tag html, head, body) dalam satu blok markdown.
               - WAJIB menyertakan CDN Tailwind CSS dan FontAwesome.
               - Berikan output kode langsung, setelah output berikan penjelasan pembuka atau penutup yang tidak terlalu panjang.`,
            safetySettings
        });

        const chat = model.startChat({ history: aiHistory });
        const parts = [];
        if(uploadedFile) parts.push(fileToGenerativePart(uploadedFile.buffer, uploadedFile.mimetype));
        parts.push({ text: message || "Jelaskan file ini." });

        const result = await chat.sendMessage(parts);
        const botResponse = result.response.text();

        await supabase.from('chat_history').insert({
            user_id: userId,
            conversation_id: conversationId,
            role: 'bot',
            message: botResponse
        });

        res.json({ success: true, response: botResponse, conversationId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, response: "Maaf, terjadi kesalahan pada server AI." });
    }
});

module.exports = router;