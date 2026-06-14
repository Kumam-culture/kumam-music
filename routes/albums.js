const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'artwork')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/albums
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { artist_id, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT al.*, u.name AS artist_name, ap.stage_name,
        COUNT(s.id) AS song_count
      FROM albums al
      JOIN users u ON al.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN songs s ON al.id = s.album_id AND s.is_published = TRUE
      WHERE al.is_published = TRUE
    `;
    const params = [];
    if (artist_id) { query += ' AND al.artist_id = ?'; params.push(artist_id); }
    query += ' GROUP BY al.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [albums] = await pool.execute(query, params);
    res.json({ albums });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/albums/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [albums] = await pool.execute(`
      SELECT al.*, u.name AS artist_name, ap.stage_name, g.name AS genre_name
      FROM albums al
      JOIN users u ON al.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON al.genre_id = g.id
      WHERE al.uuid = ? AND al.is_published = TRUE
    `, [req.params.id]);
    if (!albums.length) return res.status(404).json({ error: 'Album not found' });

    const [songs] = await pool.execute(`
      SELECT s.*, g.name AS genre_name,
        ${req.user ? '(SELECT COUNT(*) FROM likes WHERE user_id = ? AND song_id = s.id) AS liked' : '0 AS liked'}
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.album_id = ? AND s.is_published = TRUE
      ORDER BY s.track_number, s.created_at
    `, req.user ? [req.user.id, albums[0].id] : [albums[0].id]);

    res.json({ album: albums[0], songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/albums
router.post('/', authenticate, requireRole('artist'), upload.single('artwork'), async (req, res) => {
  try {
    const { title, description, genre_id, release_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const uuid = uuidv4();
    const artworkPath = req.file?.filename || null;
    const [result] = await pool.execute(
      'INSERT INTO albums (uuid, artist_id, title, description, artwork, genre_id, release_date, is_published) VALUES (?,?,?,?,?,?,?,TRUE)',
      [uuid, req.user.id, title, description || null, artworkPath, genre_id || null, release_date || null]
    );
    res.status(201).json({ message: 'Album created', albumId: result.insertId, uuid });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/albums/artist/mine
router.get('/artist/mine', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const [albums] = await pool.execute(`
      SELECT al.*, COUNT(s.id) AS song_count, SUM(s.stream_count) AS total_streams
      FROM albums al
      LEFT JOIN songs s ON al.id = s.album_id
      WHERE al.artist_id = ?
      GROUP BY al.id ORDER BY al.created_at DESC
    `, [req.user.id]);
    res.json({ albums });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
