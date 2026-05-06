export default function handler(req, res) {
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    };

    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
        res.status(500).send(`
            console.error("Supabase environment variables belum diset di Vercel.");
        `);
        return;
    }

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(`
        window.__APP_CONFIG__ = ${JSON.stringify(config)};
    `);
}