const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth.middleware');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// score helper (simple and explainable) for 7 questions scored 0-3 (max 21)
function getLevel(score) {
    if (score <= 5) return 'Low';
    if (score <= 11) return 'Mild';
    if (score <= 17) return 'Moderate';
    return 'High';
}

// GET: latest screening result (for showing previous result)
router.get('/latest', auth, (req, res) => {
    const sql = `
    SELECT score, level, created_at
    FROM screening_results
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

    db.query(sql, [req.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch latest screening result' });
        }
        res.json(rows && rows.length ? rows[0] : null);
    });
});

// GET: eligibility (used by dashboard button)
router.get('/eligibility', auth, (req, res) => {
    const sql = `
    SELECT created_at
    FROM screening_results
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

    db.query(sql, [req.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to check screening eligibility' });
        }

        if (!rows || rows.length === 0 || !rows[0].created_at) {
            return res.json({
                canTake: true,
                nextEligibleAt: null,
                lastTakenAt: null
            });
        }

        const lastTakenAt = new Date(rows[0].created_at);
        const nextEligibleAt = new Date(lastTakenAt.getTime() + WEEK_MS);
        const now = new Date();

        return res.json({
            canTake: now.getTime() >= nextEligibleAt.getTime(),
            nextEligibleAt: nextEligibleAt.toISOString(),
            lastTakenAt: lastTakenAt.toISOString()
        });
    });
});

// POST: submit screening
router.post('/submit', auth, (req, res) => {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length !== 7) {
        return res.status(400).json({ message: 'Answers must be an array of 7 values' });
    }

    for (const ans of answers) {
        const n = Number(ans);
        if (!Number.isInteger(n) || n < 0 || n > 3) {
            return res.status(400).json({ message: 'Each answer must be between 0 and 3' });
        }
    }

    // Enforce once-per-7-days (rolling window)
    const latestSql = `
    SELECT created_at
    FROM screening_results
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;

    db.query(latestSql, [req.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to validate screening frequency' });
        }

        if (rows && rows.length > 0 && rows[0].created_at) {
            const last = new Date(rows[0].created_at);
            const now = new Date();
            const diff = now.getTime() - last.getTime();

            if (diff < WEEK_MS) {
                const nextEligibleAt = new Date(last.getTime() + WEEK_MS);
                return res.status(429).json({
                    message: 'You can take the screening test only once every 7 days.',
                    nextEligibleAt: nextEligibleAt.toISOString()
                });
            }
        }

        const score = answers.reduce((sum, v) => sum + Number(v), 0);
        const level = getLevel(score);

        const insertSql = `
      INSERT INTO screening_results (user_id, score, level, answers_json)
      VALUES (?, ?, ?, ?)
    `;

        db.query(insertSql, [req.userId, score, level, JSON.stringify(answers)], (err2) => {
            if (err2) {
                return res.status(500).json({ message: 'Failed to save screening result' });
            }
            res.json({ message: 'Screening submitted', score, level });
        });
    });
});

module.exports = router;
