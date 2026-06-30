const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

// GET /api/regions — all regions with their tribes
router.get('/', async (req, res) => {
  try {
    const [regions] = await pool.query('SELECT * FROM regions ORDER BY sort_order');
    const [tribes]  = await pool.query('SELECT * FROM tribes ORDER BY region_id, sort_order');
    res.json({ regions, tribes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/regions/:regionSlug/tribes
router.get('/:regionSlug/tribes', async (req, res) => {
  try {
    const [regions] = await pool.query('SELECT * FROM regions WHERE slug = ?', [req.params.regionSlug]);
    if (!regions.length) return res.status(404).json({ error: 'Region not found' });
    const [tribes] = await pool.query(
      'SELECT * FROM tribes WHERE region_id = ? ORDER BY sort_order', [regions[0].id]
    );
    res.json({ region: regions[0], tribes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
