// Ganti dengan URL dan ANON KEY dari Dashboard Supabase Anda
const SUPABASE_URL = 'https://hmwtlyuiyzvdfvcujgsh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd3RseXVpeXp2ZGZ2Y3VqZ3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTM5NTcsImV4cCI6MjA5MTI4OTk1N30.7jU18XbVcu-zAHlqjmiDU1ToBF47ns-ju2e5ELQCaNI'; 

// Load script dari CDN terlebih dahulu di file HTML
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);