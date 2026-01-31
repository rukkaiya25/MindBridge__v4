const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth.middleware');

// GET dashboard stats
router.get('/dashboard', auth, (req, res) => {
    const sql = `
    SELECT
      AVG(mood)   AS avgMood,
      AVG(stress) AS avgStress,
      AVG(energy) AS avgEnergy,
      AVG(sleep)  AS avgSleep
    FROM daily_checkins
    WHERE user_id = ?
    `;

    db.query(sql, [req.userId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch stats' });
        }

        const stats = result[0] || { avgMood: null, avgStress: null, avgEnergy: null, avgSleep: null };

        // Screening persistence check:
        // Alert if the last 2 screenings are "High" (or "Severe") and at least 5 days apart.
        const screeningSql = `
          SELECT score, level, created_at
          FROM screening_results
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 2
        `;

        db.query(screeningSql, [req.userId], (sErr, rows) => {
            if (sErr) {
                // Don't fail the whole dashboard if screening lookup fails
                return res.json({ ...stats, screening: null, screeningAlert: null });
            }

            const latest = rows && rows.length ? rows[0] : null;
            const prev = rows && rows.length > 1 ? rows[1] : null;

            const isBad = (lvl) => {
                if (!lvl) return false;
                const v = String(lvl).toLowerCase();
                return v === 'high' || v === 'severe';
            };

            let alert = null;
            if (latest) {
                alert = {
                    shouldConsult: false,
                    reason: null,
                    asOf: latest.created_at
                };

                if (isBad(latest.level) && prev && isBad(prev.level)) {
                    const daysApartSql = `SELECT DATEDIFF(?, ?) AS daysApart`;
                    db.query(daysApartSql, [latest.created_at, prev.created_at], (dErr, dRows) => {
                        const daysApart = (!dErr && dRows && dRows[0]) ? Number(dRows[0].daysApart) : null;
                        if (daysApart != null && daysApart >= 5) {
                            alert.shouldConsult = true;
                            alert.reason = 'High screening level has persisted across screenings at least 5 days apart.';
                        }
                        return res.json({
                            ...stats,
                            screening: latest,
                            screeningAlert: alert
                        });
                    });
                    return;
                }

                // No persistence alert
                return res.json({
                    ...stats,
                    screening: latest,
                    screeningAlert: alert
                });
            }

            return res.json({
                ...stats,
                screening: null,
                screeningAlert: null
            });
        });
    });
});

// GET last 7 days trend
router.get('/weekly', auth, (req, res) => {
    const sql = `
    SELECT date, mood, stress, energy, sleep
     FROM daily_checkins
     WHERE user_id = ?
     ORDER BY date DESC
     LIMIT 7

  `;

    db.query(sql, [req.userId], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch weekly data' });
        }
        res.json(result);
    });
});

module.exports = router;