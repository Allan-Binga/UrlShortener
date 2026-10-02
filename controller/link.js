const { randomBytes } = require("node:crypto");
const pool = require("../db/db");

const shortLink = async (req, res) => {
    const originalUrl = req.body?.original_url;

    if (typeof originalUrl !== "string" || !originalUrl.trim()) {
        return res.status(400).json({ error: "original_url is required" });
    }

    try {
        const url = new URL(originalUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
            return res.status(400).json({ error: "Use an HTTP or HTTPS URL" });
        }
    } catch {
        return res.status(400).json({ error: "Provide a valid URL, including http:// or https://" });
    }

    const shortCode = randomBytes(6).toString("hex");

    try {
        const result = await pool.query(
            "INSERT INTO links (short_code, original_url) VALUES ($1, $2) RETURNING short_code, original_url, created_at",
            [shortCode, originalUrl.trim()]
        );

        return res.status(201).json({
            ...result.rows[0],
            short_url: `${req.protocol}://${req.get("host")}/${shortCode}`,
        });
    } catch (error) {
        console.error("Failed to create link:", error.code, error.message);
        if (error.code === "23505") {
            return res.status(503).json({ error: "Could not generate a unique code. Please try again." });
        }
        return res.status(500).json({ error: "Could not create link" });
    }
};

const redirectLink = async (req, res) => {
    const { shortCode } = req.params;
    if (!/^[A-Za-z0-9]{1,16}$/.test(shortCode)) {
        return res.status(404).json({ error: "Link not found" });
    }

    try {
        const result = await pool.query(
            "SELECT original_url FROM links WHERE short_code = $1",
            [shortCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Link not found" });
        }

        return res.redirect(302, result.rows[0].original_url);
    } catch (error) {
        console.error("Failed to find link:", error.code, error.message);
        return res.status(500).json({ error: "Could not look up link" });
    }
};

module.exports = { shortLink, redirectLink };
