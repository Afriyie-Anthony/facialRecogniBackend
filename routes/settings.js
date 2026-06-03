// routes/settings.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/auth');

router.use(protect);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM settings LIMIT 1');
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — save what the Settings page submits
router.put('/', async (req, res) => {
  const { schoolName, defaultSession, cutoffTime, allowLateMarking } = req.body;

  try {
    await db.execute(
      `UPDATE settings SET
        school_name        = ?,
        default_session    = ?,
        cutoff_time        = ?,
        allow_late_marking = ?
       WHERE id = 1`,
      [schoolName, defaultSession, cutoffTime, allowLateMarking ? 1 : 0]
    );

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;