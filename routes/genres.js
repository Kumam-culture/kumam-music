const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

// GET /api/genres
router.get('/', async (req, res) => {
  try {
    const [genres] = await pool.query('SELECT * FROM genres ORDER BY sort_order');
    res.json({ genres });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
