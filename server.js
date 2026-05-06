// server.js

require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/config.js", (req, res) => {
    const config = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    };

    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
        res.status(500)
            .type("application/javascript")
            .send(`
                console.error("SUPABASE_URL atau SUPABASE_ANON_KEY belum ada di .env");
            `);
        return;
    }

    res.type("application/javascript");
    res.setHeader("Cache-Control", "no-store");
    res.send(`
        window.__APP_CONFIG__ = ${JSON.stringify(config)};
    `);
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});