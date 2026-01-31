// src/config/db.js
const mysql = require("mysql2");
require("dotenv").config();

/**
 * Aiven MySQL requires TLS. On Render, multiline PEM env vars often break.
 * Use DB_CA_CERT_B64 (base64-encoded CA cert) as the primary method.
 *
 * Env vars expected:
 * DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * DB_CA_CERT_B64  (recommended)
 * or DB_CA_CERT   (raw PEM, with real newlines or \n)
 */

function buildSslConfig() {
  // Preferred: base64-encoded PEM
  if (process.env.DB_CA_CERT_B64 && process.env.DB_CA_CERT_B64.trim()) {
    const caPem = Buffer.from(process.env.DB_CA_CERT_B64, "base64").toString("utf8");
    return { ca: caPem, rejectUnauthorized: true };
  }

  // Fallback: raw PEM in env var (handle escaped newlines)
  if (process.env.DB_CA_CERT && process.env.DB_CA_CERT.trim()) {
    const caPem = process.env.DB_CA_CERT.replace(/\\n/g, "\n");
    return { ca: caPem, rejectUnauthorized: true };
  }

  // If no CA is provided, return undefined (will likely fail with Aiven SSL REQUIRED)
  return undefined;
}

const ssl = buildSslConfig();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Log a clear startup status
db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
    console.error("DB_HOST:", process.env.DB_HOST);
    console.error("DB_PORT:", process.env.DB_PORT);
    console.error("DB_NAME:", process.env.DB_NAME);
    console.error("DB_USER:", process.env.DB_USER);
    console.error("CA provided (B64):", !!process.env.DB_CA_CERT_B64);
    console.error("CA provided (PEM):", !!process.env.DB_CA_CERT);
  } else {
    console.log("✅ Connected to MySQL");
    conn.release();
  }
});

module.exports = db;
