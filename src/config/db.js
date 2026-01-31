const mysql = require("mysql2");
require("dotenv").config();

const sslConfig = process.env.DB_CA_CERT
  ? { ca: process.env.DB_CA_CERT, rejectUnauthorized: true }
  : undefined;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: sslConfig,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL (Aiven)");
    conn.release();
  }
});

module.exports = db;
