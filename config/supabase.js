const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rvguyovrjffvnwlmksrh.supabase.co'; 
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z3V5b3ZyamZmdm53bG1rc3JoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE3NTQ1NCwiZXhwIjoyMDc4NzUxNDU0fQ.1fVEvegSpYP6PAyqBAocmD3v0cUAbQ_LxQxQXyPfcY4';

const actualSupabaseUrl = process.env.SUPABASE_URL || supabaseUrl;
const actualSupabaseKey = process.env.SUPABASE_KEY || supabaseKey;

let supabase;
try {
    supabase = createClient(actualSupabaseUrl, actualSupabaseKey);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

module.exports = supabase;