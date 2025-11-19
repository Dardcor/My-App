// NAMA FILE BARU: discordHandler.js
const { WebhookClient, EmbedBuilder } = require('discord.js');

// Pastikan URL Webhook ini valid dan tidak expired
const webhookHealth = new WebhookClient({ url: 'https://discord.com/api/webhooks/1439194800208347239/7y-FpvhkfxF1vlXBgp-TxPjWEbzIyCiuik4Sv6ybAH6voxRTPXxVVapM8ttX33eGApFD' });
const webhookPrayer = new WebhookClient({ url: 'https://discord.com/api/webhooks/1439194890700329041/gNahM2MDCB6nnMafqr0uBPR7Sks8w3eOIHRxZz-5OKNsyinN7fs5b8KYwZJ2lzHcXp1N' });
const webhookWallet = new WebhookClient({ url: 'https://discord.com/api/webhooks/1439195115804557332/fYm-8MCwd2zcxeu3njdbd4tgL8l9b0mGB-FJVdOq6t8cYQs9F3vcDuHPLvlNUmmM-8po' });

// CATATAN: Karena deploy di Vercel (Serverless), variabel 'logs' ini akan reset setiap kali server idle.
// Jika ingin log permanen, harus disimpan di Supabase.
const logs = [];

const createEmbed = (title, description, color, fields = []) => {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .addFields(fields)
        .setFooter({ text: 'Waktu Sidoarjo (WIB)', iconURL: 'https://i.imgur.com/AfFp7pu.png' })
        .setTimestamp();
};

const logToMemory = (title, message, color) => {
    const timeWIB = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'medium',
        timeStyle: 'medium'
    });

    logs.push({
        title,
        message,
        color: color.toString(16),
        timestamp: timeWIB
    });
    if (logs.length > 50) logs.shift();
};

const sendHealthReminder = async () => {
    try {
        const tips = [
            "Minum air putih minimal 2 liter sehari!",
            "Jangan lupa regangkan badan setelah duduk lama.",
            "Istirahatkan mata dari layar gadget sejenak.",
            "Sudah makan buah hari ini?",
            "Jaga postur dudukmu agar punggung tidak sakit.",
            "Tarik napas dalam-dalam dan rileks sejenak."
        ];
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        const embed = createEmbed("🌿 Pengingat Hidup Sehat", randomTip, 0x00FF00);
        logToMemory("Health Reminder", randomTip, 0x00FF00);
        
        await webhookHealth.send({
            username: 'Health Bot',
            avatarURL: 'https://i.imgur.com/AfFp7pu.png',
            embeds: [embed]
        });
        console.log("Health reminder sent successfully.");
    } catch (error) {
        console.error('Error sending Health Reminder:', error);
    }
};

const sendPrayerReminder = async (waktu) => {
    try {
        const messages = {
            'Subuh': "🌙 Waktunya Sholat Subuh untuk wilayah Sidoarjo & Sekitarnya.",
            'Dzuhur': "☀️ Waktunya Sholat Dzuhur. Istirahat sejenak dan tunaikan kewajiban.",
            'Ashar': "🌤️ Waktunya Sholat Ashar. Jangan tunda sholatmu.",
            'Maghrib': "🌇 Waktunya Sholat Maghrib. Akhiri siangmu dengan ibadah.",
            'Isya': "🌌 Waktunya Sholat Isya. Tutup harimu dengan ketenangan."
        };
        
        const msg = messages[waktu] || `Waktunya Sholat ${waktu}`;
        const embed = createEmbed(`🕌 Adzan ${waktu}`, msg, 0x0099FF);
        logToMemory("Prayer Reminder", msg, 0x0099FF);

        await webhookPrayer.send({
            username: 'Prayer Bot',
            avatarURL: 'https://i.imgur.com/AfFp7pu.png',
            embeds: [embed]
        });
        console.log(`Prayer reminder for ${waktu} sent.`);
    } catch (error) {
        console.error('Error sending Prayer Reminder:', error);
    }
};

const sendTransactionLog = async (action, data, oldData = null) => {
    try {
        const formatRupiah = (num) => `Rp ${parseFloat(num).toLocaleString('id-ID')}`;
        let title, message, color, fields = [];

        if (action === 'add') {
            title = '💸 Transaksi Baru';
            message = `Tipe: **${data.type.toUpperCase()}**`;
            color = data.type === 'deposit' || data.type === 'reward' ? 0x00FF00 : 0xFF0000;
            fields = [
                { name: 'Jumlah', value: formatRupiah(data.amount), inline: true },
                { name: 'Deskripsi', value: data.description || '-', inline: true }
            ];
            if (data.recipient) fields.push({ name: 'Penerima', value: data.recipient, inline: true });

        } else if (action === 'edit') {
            title = '✏️ Transaksi Diedit';
            message = `ID Transaksi: ${data.id}`;
            color = 0xFFA500;
            fields = [
                { name: 'Sebelum', value: `${oldData.description} (${formatRupiah(oldData.amount)})` },
                { name: 'Sesudah', value: `${data.description} (${formatRupiah(data.amount)})` }
            ];

        } else if (action === 'delete') {
            title = '🗑️ Transaksi Dihapus';
            message = `ID Transaksi: ${data.id}`;
            color = 0x808080;
            fields = [
                { name: 'Jumlah', value: formatRupiah(data.amount), inline: true },
                { name: 'Deskripsi', value: data.description || '-', inline: true }
            ];
        }

        const embed = createEmbed(title, message, color, fields);
        logToMemory(title, message, color);

        await webhookWallet.send({
            username: 'MyWallet History',
            avatarURL: 'https://i.imgur.com/AfFp7pu.png',
            embeds: [embed]
        });
        console.log("Transaction log sent.");
    } catch (error) {
        console.error('Error sending Transaction Log:', error);
    }
};

const getLogs = () => {
    return logs;
};

module.exports = {
    sendHealthReminder,
    sendPrayerReminder,
    sendTransactionLog,
    getLogs
};