const SUPABASE_URL = window.__APP_CONFIG__?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__APP_CONFIG__?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Konfigurasi Supabase belum tersedia. Pastikan /api/config.js sudah diload sebelum js/supabase.js.");
}

window.supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);