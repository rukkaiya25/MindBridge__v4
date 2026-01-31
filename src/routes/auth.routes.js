const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

// REGISTER
router.post('/register', (req, res) => {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';

    db.query(sql, [name, email, hashedPassword], (err) => {
        if (err) {
            // Duplicate email (unique constraint)
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'User already exists' });
            }
            return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'User registered successfully' });
    });
});

// LOGIN
router.post('/login', (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const sql = 'SELECT id, password FROM users WHERE email = ? LIMIT 1';

    db.query(sql, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (!result || !result.length) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result[0];
        const valid = bcrypt.compareSync(password, user.password);

        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ token });
    });
});

// CHANGE PASSWORD (AUTH REQUIRED)
router.post('/change-password', auth, (req, res) => {
    const oldPassword = req.body.oldPassword;
    const newPassword = req.body.newPassword;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'All fields required' });
    }

    db.query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!rows || !rows.length) return res.status(404).json({ message: 'User not found' });

        const ok = bcrypt.compareSync(oldPassword, rows[0].password);
        if (!ok) return res.status(401).json({ message: 'Old password incorrect' });

        const hashed = bcrypt.hashSync(newPassword, 10);
        db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.userId], (uErr) => {
            if (uErr) return res.status(500).json({ message: 'Failed to update password' });
            res.json({ message: 'Password updated successfully' });
        });
    });
});

// GET current user profile (minimal)
router.get('/me', auth, (req, res) => {
    const sql = 'SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1';
    db.query(sql, [req.userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to fetch profile' });
        res.json(result[0] || null);
    });
});

module.exports = router;
