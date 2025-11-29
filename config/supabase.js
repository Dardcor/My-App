const { createClient } = require('@supabase/supabase-js');

// Mengambil URL dan Key dari Environment Variables (process.env)
// Jika tidak ditemukan, aplikasi akan gagal inisialisasi, mencegah kebocoran.
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Disarankan menggunakan SERVICE_KEY di backend/server

let supabase;

try {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL atau Key tidak diatur di Environment Variables.");
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
    console.error(`Gagal inisialisasi Supabase: ${error.message}`);
    // Lebih baik keluar dari proses jika kunci rahasia hilang
    process.exit(1); 
}

module.exports = supabase;