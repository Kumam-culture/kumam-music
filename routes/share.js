const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

// POST /api/share — create or get share link
router.post('/', async (req, res) => {
  try {
    const { type, ref_uuid, ref_title } = req.body;
    const validTypes = ['song','album','artist','playlist','site'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid share type' });

    // Check if share link already exists for this ref
    let existing = null;
    if (ref_uuid) {
      const [rows] = await pool.query(
        'SELECT * FROM share_links WHERE type = ? AND ref_uuid = ?', [type, ref_uuid]
      );
      existing = rows[0] || null;
    }

    if (existing) {
      return res.json({ share_uuid: existing.uuid, url: buildUrl(req, existing.uuid) });
    }

    const uuid = uuidv4();
    await pool.query(
      'INSERT INTO share_links (uuid, type, ref_uuid, ref_title) VALUES (?,?,?,?)',
      [uuid, type, ref_uuid || null, ref_title || null]
    );

    res.json({ share_uuid: uuid, url: buildUrl(req, uuid) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/share/:uuid — resolve share link (track click + redirect info)
router.get('/:uuid', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM share_links WHERE uuid = ?', [req.params.uuid]);
    if (!rows.length) return res.status(404).json({ error: 'Share link not found' });
    const link = rows[0];

    // Track click
    await pool.query('UPDATE share_links SET click_count = click_count + 1 WHERE id = ?', [link.id]);

    res.json({
      type: link.type,
      ref_uuid: link.ref_uuid,
      ref_title: link.ref_title,
      click_count: link.click_count + 1
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const buildUrl = (req, shareUuid) => {
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/?share=${shareUuid}`;
};

module.exports = router;
