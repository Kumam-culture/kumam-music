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

// ── GET /api/albums/artist/mine  (BEFORE /:id) ─────────────────
router.get('/artist/mine', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const [albums] = await pool.query(`
      SELECT al.*, COUNT(s.id) AS song_count, COALESCE(SUM(s.stream_count),0) AS total_streams
      FROM albums al
      LEFT JOIN songs s ON al.id = s.album_id
      WHERE al.artist_id = ?
      GROUP BY al.id ORDER BY al.created_at DESC
    `, [req.user.id]);
    res.json({ albums });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/albums ─────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit    = Math.max(1, Math.min(100, parseInt(req.query.limit)  || 20));
    const offset   = Math.max(0, parseInt(req.query.offset) || 0);
    const artistId = req.query.artist_id ? parseInt(req.query.artist_id) : null;

    let where = 'WHERE al.is_published = TRUE';
    if (artistId) where += ` AND al.artist_id = ${pool.escape(artistId)}`;

    const [albums] = await pool.query(`
      SELECT al.*, u.name AS artist_name, ap.stage_name,
        COUNT(s.id) AS song_count
      FROM albums al
      JOIN users u ON al.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN songs s ON al.id = s.album_id AND s.is_published = TRUE
      ${where}
      GROUP BY al.id, al.uuid, al.artist_id, al.title, al.description,
        al.artwork, al.genre_id, al.release_date, al.is_published,
        al.total_streams, al.created_at, u.name, ap.stage_name
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({ albums });
  } catch (err) {
    console.error('GET /albums error:', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/albums/:id ─────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [albums] = await pool.query(`
      SELECT al.*, u.name AS artist_name, u.uuid AS artist_uuid,
        ap.stage_name, g.name AS genre_name
      FROM albums al
      JOIN users u ON al.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON al.genre_id = g.id
      WHERE al.uuid = ? AND al.is_published = TRUE
    `, [req.params.id]);
    if (!albums.length) return res.status(404).json({ error: 'Album not found' });

    const userId = req.user ? req.user.id : null;
    const likedExpr = userId !== null
      ? `(SELECT COUNT(*) FROM likes WHERE user_id = ${pool.escape(userId)} AND song_id = s.id) AS liked`
      : `0 AS liked`;

    const [songs] = await pool.query(`
      SELECT s.*, g.name AS genre_name, ${likedExpr}
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE s.album_id = ? AND s.is_published = TRUE
      ORDER BY s.track_number, s.created_at
    `, [albums[0].id]);

    res.json({ album: albums[0], songs });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/albums ────────────────────────────────────────────
router.post('/', authenticate, requireRole('artist'), upload.single('artwork'), async (req, res) => {
  try {
    const { title, description, genre_id, release_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const uuid       = uuidv4();
    const artworkPath= req.file?.filename || null;
    const genreIdVal = genre_id ? parseInt(genre_id) : null;
    const [result] = await pool.query(
      'INSERT INTO albums (uuid,artist_id,title,description,artwork,genre_id,release_date,is_published) VALUES (?,?,?,?,?,?,?,TRUE)',
      [uuid, req.user.id, title, description||null, artworkPath, genreIdVal, release_date||null]
    );
    res.status(201).json({ message: 'Album created', albumId: result.insertId, uuid });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
