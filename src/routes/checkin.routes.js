const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth.middleware');

// ADD / UPDATE (ONE EDIT) DAILY CHECK-IN FOR TODAY
router.post('/', auth, (req, res) => {
    const { mood, stress, energy, sleep, note } = req.body;

    if (mood == null || stress == null || energy == null || sleep == null) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // One check-in per day; allow exactly one edit for today's check-in.
    const selectSql = `
      SELECT id, edit_count
      FROM daily_checkins
      WHERE user_id = ? AND date = CURDATE()
      LIMIT 1
    `;

    db.query(selectSql, [req.userId], (sErr, rows) => {
        if (sErr) {
            console.error(sErr);
            return res.status(500).json({ message: 'Failed to save check-in' });
        }

        if (!rows.length) {
            const insertSql = `
              INSERT INTO daily_checkins (user_id, date, mood, stress, energy, sleep, note, edit_count)
              VALUES (?, CURDATE(), ?, ?, ?, ?, ?, 0)
            `;
            return db.query(insertSql, [req.userId, mood, stress, energy, sleep, note || null], (iErr) => {
                if (iErr) {
                    console.error(iErr);
                    return res.status(500).json({ message: 'Failed to save check-in' });
                }
                return res.json({ message: 'Check-in saved successfully', edited: false });
            });
        }

        const current = rows[0];
        const editCount = Number(current.edit_count || 0);

        if (editCount >= 1) {
            return res.status(403).json({ message: "Today's check-in can only be edited once" });
        }

        const updateSql = `
          UPDATE daily_checkins
          SET mood = ?, stress = ?, energy = ?, sleep = ?, note = ?, edit_count = edit_count + 1
          WHERE id = ? AND user_id = ?
        `;

        return db.query(
            updateSql,
            [mood, stress, energy, sleep, note || null, current.id, req.userId],
            (uErr) => {
                if (uErr) {
                    console.error(uErr);
                    return res.status(500).json({ message: 'Failed to save check-in' });
                }
                return res.json({ message: 'Check-in updated successfully', edited: true });
            }
        );
    });
});

// GET ALL CHECK-INS (for charts)
router.get('/', auth, (req, res) => {
    const sql = `
      SELECT date, mood, stress, energy, sleep
      FROM daily_checkins
      WHERE user_id = ?
      ORDER BY date ASC
    `;

    db.query(sql, [req.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(result);
    });
});

// CHECK IF TODAY'S CHECK-IN EXISTS
router.get('/today', auth, (req, res) => {
    const sql = `
      SELECT id
      FROM daily_checkins
      WHERE user_id = ? AND date = CURDATE()
      LIMIT 1
    `;

    db.query(sql, [req.userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ exists: false });
        }

        return res.json({ exists: rows.length > 0 });
    });
});

// GET LATEST CHECK-IN (for dashboard cards)
router.get('/latest', auth, (req, res) => {
    const sql = `
      SELECT mood, stress, energy, sleep, note, date, edit_count
      FROM daily_checkins
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 1
    `;

    db.query(sql, [req.userId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(rows[0] || null);
    });
});

module.exports = router;
