// Import 'node-cron' untuk tugas terjadwal
const cron = require('node-cron');

// --- PENGATURAN WEBHOOK ---
// (Dapatkan URL ini dari Discord: Edit Channel -> Integrations -> Webhooks)
const WEBHOOK_URL_SEHAT = 'https://discord.com/api/webhooks/1439194800208347239/7y-FpvhkfxF1vlXBgp-TxPjWEbzIyCiuik4Sv6ybAH6voxRTPXxVVapM8ttX33eGApFD';
const WEBHOOK_URL_PAYMENT = 'https://discord.com/api/webhooks/1439194890700329041/gNahM2MDCB6nnMafqr0uBPR7Sks8w3eOIHRxZz-5OKNsyinN7fs5b8KYwZJ2lzHcXp1N';
const WEBHOOK_URL_CHANNEL_3 = 'https://discord.com/api/webhooks/1439195115804557332/fYm-8MCwd2zcxeu3njdbd4tgL8l9b0mGB-FJVdOq6t8cYQs9F3vcDuHPLvlNUmmM-8po';
// ----------------------------

/**
 * Fungsi inti untuk mengirim data ke Discord.
 * @param {string} url - URL Webhook tujuan.
 * @param {object} payload - Konten yang akan dikirim (bisa 'content' atau 'embeds').
 */
async function sendWebhook(url, payload) {
    // Jangan kirim jika URL belum diatur
    if (!url || !url.startsWith('http')) {
        console.warn('URL Webhook tidak diatur atau tidak valid.');
        return; 
    }

    try {
        // Menggunakan fetch bawaan Node.js (seperti di server.js Anda)
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Gagal mengirim webhook:', error.message);
    }
}

// --- CHANNEL 1: Pengingat Hidup Sehat (Setiap 1 Jam) ---

const healthyReminders = [
    'Waktunya minum air putih! 💧',
    'Sudah 1 jam, ayo berdiri dan regangkan badan sebentar. 🚶‍♂️',
    'Istirahatkan matamu dari layar. Lihat ke luar jendela selama 20 detik. 🌿',
    'Snack time! Pilih buah-buahan segar atau kacang-kacangan. 🍎',
    'Cek postur dudukmu. Apakah sudah tegak? 🧘'
];

/**
 * Memulai cron job yang mengirim pengingat sehat setiap jam.
 */
function startHealthyReminder() {
    // '0 * * * *' = berjalan setiap jam, di menit ke-0
    cron.schedule('0 * * * *', () => {
        console.log('Mengirim pengingat sehat ke Channel 1...');
        const message = healthyReminders[Math.floor(Math.random() * healthyReminders.length)];
        
        const payload = {
            username: 'Asisten Sehat',
            avatar_url: 'https://i.imgur.com/g89ySjL.png', // Ikon Hati
            content: `**⏰ Pengingat Hidup Sehat!**\n${message}`
        };
        
        sendWebhook(WEBHOOK_URL_SEHAT, payload);
    });
    
    console.log('Layanan Pengingat Sehat (Cron Job) telah dimulai.');
}

// --- CHANNEL 2: Log Pembayaran (Sesuai Permintaan) ---

/**
 * Mengirim log transaksi ke channel payment.
 * @param {string} action - Tipe aksi ('add', 'edit', 'delete').
 * @param {object} transactionData - Data transaksi yang baru.
 * @param {object} [oldData] - Data transaksi lama (khusus untuk 'edit').
 */
async function sendPaymentLog(action, transactionData, oldData = null) {
    let embed = {
        title: 'Laporan Transaksi',
        color: 0xAAAAAA, // Abu-abu
        footer: { text: `User ID: ${transactionData.user_id} | ID Transaksi: ${transactionData.id}` },
        timestamp: new Date().toISOString()
    };

    if (action === 'add') {
        embed.title = `✅ Transaksi Baru: ${transactionData.description}`;
        // Warna hijau untuk pemasukan, merah untuk pengeluaran
        embed.color = (transactionData.type === 'deposit' || transactionData.type === 'reward') ? 0x2ECC71 : 0xE74C3C;
        embed.fields = [
            { name: 'Tipe', value: transactionData.type, inline: true },
            { name: 'Jumlah', value: `Rp ${(transactionData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}`, inline: true }
        ];
        if (transactionData.recipient) {
            embed.fields.push({ name: 'Penerima', value: transactionData.recipient, inline: true });
        }
    } 
    else if (action === 'edit' && oldData) {
        embed.title = `✏️ Transaksi Diubah: ${transactionData.description}`;
        embed.color = 0xF1C40F; // Kuning
        embed.description = `**Deskripsi:** \`${oldData.description}\` -> \`${transactionData.description}\`\n` +
                            `**Jumlah:** \`Rp ${(oldData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\` -> \`Rp ${(transactionData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\``;
    } 
    else if (action === 'delete') {
        embed.title = `❌ Transaksi Dihapus`;
        embed.color = 0xE74C3C; // Merah
        embed.description = `**Deskripsi:** \`${transactionData.description}\`\n` +
                            `**Jumlah:** \`Rp ${(transactionData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\`\n` +
                            `**Tipe:** \`${transactionData.type}\``;
    }

    const payload = {
        username: 'Log MyWallet',
        avatar_url: 'https://i.imgur.com/v1k3rWj.png', // Ikon dompet
        embeds: [embed]
    };
    
    await sendWebhook(WEBHOOK_URL_PAYMENT, payload);
}

// --- CHANNEL 3: Fungsi Cadangan ---

/**
 * Mengirim pesan sederhana ke Channel 3 (Placeholder).
 * @param {string} message - Pesan yang ingin dikirim.
 */
async function sendToChannel3(message) {
    const payload = {
        username: 'Bot Channel 3',
        content: message
    };
    await sendWebhook(WEBHOOK_URL_CHANNEL_3, payload);
}

// Ekspor fungsi-fungsi agar bisa dipakai di server.js
module.exports = {
    startHealthyReminder, // Untuk dijalankan sekali saat server hidup
    sendPaymentLog,       // Untuk dijalankan setiap ada transaksi
    sendToChannel3        // Untuk Anda gunakan nanti
};