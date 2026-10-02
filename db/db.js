const { Pool } = require("pg");
require("dotenv").config();

function describeConnectionError(err) {
  const errors = err.errors?.length ? err.errors : [err];
  return errors.map((error) =>
    [error.code, error.message || error.name].filter(Boolean).join(": ")
  ).join("; ");
}

const production = process.env.NODE_ENV === "production";
if (production && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

// Neon connection strings carry their TLS settings (use sslmode=verify-full).
// Do not override the URL with rejectUnauthorized: false.
const pool = new Pool(production ? {
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
} : {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

pool.on("error", (err) => {
  console.error("PostgreSQL idle connection error:", describeConnectionError(err));
});

// pool.query returns its connection automatically after the startup check.
if (process.env.NODE_ENV !== "test") {
  pool.query("SELECT 1")
    .then(() => console.log("Connected to PostgreSQL database"))
    .catch((err) => console.error("PostgreSQL startup check failed:", describeConnectionError(err)));
}

module.exports = pool;
