const { randomBytes } = require("node:crypto");
const pool = require("../db/db");

// POST /api/links: save a URL and return its generated short link.
const shortLink = async (req, res) => {
    // express.json() supplies req.body; optional chaining handles a missing body.
    const originalUrl = req.body?.original_url;

    // Reject missing, non-string, or blank input before querying PostgreSQL.
    if (typeof originalUrl !== "string" || !originalUrl.trim()) {
        return res.status(400).json({ error: "original_url is required" });
    }

    // URL parses the address; the protocol check limits destinations to web URLs.
    try {
        const url = new URL(originalUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
            return res.status(400).json({ error: "Use an HTTP or HTTPS URL" });
        }
    } catch {
        return res.status(400).json({ error: "Provide a valid URL, including http:// or https://" });
    }

    // Six random bytes become 12 hexadecimal characters, fitting the table constraints.
    const shortCode = randomBytes(6).toString("hex");

    try {
        // Pass values separately via $1 and $2 to avoid treating user input as SQL.
        // PostgreSQL supplies created_at; RETURNING gives us the newly saved row.
        const result = await pool.query(
            "INSERT INTO links (short_code, original_url) VALUES ($1, $2) RETURNING short_code, original_url, created_at",
            [shortCode, originalUrl.trim()]
        );

        // Build a visitable URL using the protocol and host of this request.
        return res.status(201).json({
            ...result.rows[0],
            short_url: `${req.protocol}://${req.get("host")}/${shortCode}`,
        });
    } catch (error) {
        console.error("Failed to create link:", error.code, error.message);
        // PostgreSQL code 23505 means a unique constraint was violated (code collision).
        if (error.code === "23505") {
            return res.status(503).json({ error: "Could not generate a unique code. Please try again." });
        }
        return res.status(500).json({ error: "Could not create link" });
    }
};

// GET /:shortCode: find the stored destination and tell the browser to visit it.
const redirectLink = async (req, res) => {
    const { shortCode } = req.params;
    // Match the table's code format before making a database lookup.
    if (!/^[A-Za-z0-9]{1,16}$/.test(shortCode)) {
        return res.status(404).json({ error: "Link not found" });
    }

    try {
        // The primary key identifies at most one row for this code.
        const result = await pool.query(
            "SELECT original_url FROM links WHERE short_code = $1",
            [shortCode]
        );

        // A valid-looking code may still have no saved link.
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Link not found" });
        }

        // A 302 response sends a Location header; the browser follows the destination.
        return res.redirect(302, result.rows[0].original_url);
    } catch (error) {
        console.error("Failed to find link:", error.code, error.message);
        return res.status(500).json({ error: "Could not look up link" });
    }
};

module.exports = { shortLink, redirectLink };
