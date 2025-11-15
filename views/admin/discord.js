const cron = require('node-cron');

const WEBHOOK_URL_SEHAT = 'https://discord.com/api/webhooks/1439194800208347239/7y-FpvhkfxF1vlXBgp-TxPjWEbzIyCiuik4Sv6ybAH6voxRTPXxVVapM8ttX33eGApFD';
const WEBHOOK_URL_PAYMENT = 'https://discord.com/api/webhooks/1439194890700329041/gNahM2MDCB6nnMafqr0uBPR7Sks8w3eOIHRxZz-5OKNsyinN7fs5b8KYwZJ2lzHcXp1N';
const WEBHOOK_URL_CHANNEL_3 = 'https://discord.com/api/webhooks/1439195115804557332/fYm-8MCwd2zcxeu3njdbd4tgL8l9b0mGB-FJVdOq6t8cYQs9F3vcDuHPLvlNUmmM-8po';

const logs = [];
const MAX_LOGS = 100;

function log(message) {
    console.log(message);
    const logEntry = {
        timestamp: new Date(),
        message: message
    };
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
}

function getLogs() {
    return logs;
}

async function sendWebhook(url, payload) {
    if (!url || !url.startsWith('http')) {
        log('URL Webhook tidak diatur atau tidak valid.');
        return; 
    }
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        log(`Gagal mengirim webhook: ${error.message}`);
    }
}

const healthyReminders = [
    'Waktunya minum air putih! 💧',
    'Sudah 1 jam, ayo berdiri dan regangkan badan sebentar. 🚶‍♂️',
    'Istirahatkan matamu dari layar. Lihat ke luar jendela selama 20 detik. 🌿',
    'Snack time! Pilih buah-buahan segar atau kacang-kacangan. 🍎',
    'Cek postur dudukmu. Apakah sudah tegak? 🧘'
];

function startHealthyReminder() {
    cron.schedule('0 * * * *', () => {
        log('Mengirim pengingat sehat ke Channel 1...');
        const message = healthyReminders[Math.floor(Math.random() * healthyReminders.length)];
        const payload = {
            username: 'Asisten Sehat',
            avatar_url: 'https://i.imgur.com/g89ySjL.png',
            content: `**⏰ Pengingat Hidup Sehat!**\n${message}`
        };
        sendWebhook(WEBHOOK_URL_SEHAT, payload);
    }, {
        timezone: "Asia/Jakarta"
    });
    
    log('Layanan Pengingat Sehat (Cron Job) telah dimulai.');
}

async function sendPaymentLog(action, transactionData, oldData = null) {
    let embed = {
        title: 'Laporan Transaksi',
        color: 0xAAAAAA,
        footer: { text: `User ID: ${transactionData.user_id} | ID Transaksi: ${transactionData.id}` },
        timestamp: new Date().toISOString()
    };

    if (action === 'add') {
        embed.title = `✅ Transaksi Baru: ${transactionData.description}`;
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
        embed.color = 0xF1C40F;
        embed.description = `**Deskripsi:** \`${oldData.description}\` -> \`${transactionData.description}\`\n` +
                            `**Jumlah:** \`Rp ${(oldData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\` -> \`Rp ${(transactionData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\``;
    } 
    else if (action === 'delete') {
        embed.title = `❌ Transaksi Dihapus`;
        embed.color = 0xE74C3C;
        embed.description = `**Deskripsi:** \`${transactionData.description}\`\n` +
                            `**Jumlah:** \`Rp ${(transactionData.amount || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}\`\n` +
                            `**Tipe:** \`${transactionData.type}\``;
    }

    const payload = {
        username: 'MyWallet',
        avatar_url: 'https://i.imgur.com/v1k3rWj.png',
        embeds: [embed]
    };
    
    await sendWebhook(WEBHOOK_URL_PAYMENT, payload);
    log(`Log pembayaran [${action}] dikirim ke Channel 2.`);
}

const prayerTimes = {
    '30 4 * * *': 'Subuh',
    '0 12 * * *': 'Dzuhur',
    '0 15 * * *': 'Ashar',
    '0 18 * * *': 'Maghrib',
    '0 19 * * *': 'Isya'
};

function startPrayerReminder() {
    Object.entries(prayerTimes).forEach(([time, name]) => {
        cron.schedule(time, () => {
            log(`Mengirim pengingat sholat ${name}...`);
            const payload = {
                username: 'Pengingat Sholat',
                avatar_url: 'https://i.imgur.com/kQjYfSj.png',
                content: `🕋 Waktunya Sholat **${name}** telah tiba untuk wilayah Anda.`
            };
            sendWebhook(WEBHOOK_URL_CHANNEL_3, payload);
        }, {
            timezone: "Asia/Jakarta"
        });
    });
    log('Layanan Pengingat Sholat (Cron Job) telah dimulai.');
}

module.exports = {
    startHealthyReminder,
    sendPaymentLog,
    startPrayerReminder,
    getLogs
};