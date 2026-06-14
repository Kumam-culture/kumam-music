const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const fs = require('fs');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'audio' ? 'uploads/songs' : 'uploads/artwork';
    cb(null, path.join(__dirname, '..', dir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      if (!['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'].includes(file.mimetype))
        return cb(new Error('Invalid audio format'));
    } else {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
        return cb(new Error('Invalid image format'));
    }
    cb(null, true);
  }
});

const RATE_PER_STREAM = 0.001; // UGX 1 per 1000 streams

// GET /api/songs - public listing
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { genre, limit = 20, offset = 0, sort = 'newest' } = req.query;
    let query = `
      SELECT s.*, u.name AS artist_name, u.avatar AS artist_avatar,
        ap.stage_name, g.name AS genre_name,
        al.title AS album_title, al.artwork AS album_artwork,
        ${req.user ? '(SELECT COUNT(*) FROM likes WHERE user_id = ? AND song_id = s.id) AS liked,' : '0 AS liked,'}
        s.stream_count
      FROM songs s
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.is_published = TRUE
    `;
    const params = req.user ? [req.user.id] : [];
    if (genre) { query += ' AND g.slug = ?'; params.push(genre); }
    if (sort === 'trending') query += ' ORDER BY s.stream_count DESC';
    else if (sort === 'popular') query += ' ORDER BY s.stream_count DESC';
    else query += ' ORDER BY s.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [songs] = await pool.execute(query, params);
    res.json({ songs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/songs/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT s.*, u.name AS artist_name, u.avatar AS artist_avatar,
        ap.stage_name, g.name AS genre_name,
        al.title AS album_title, al.artwork AS album_artwork
      FROM songs s
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.uuid = ? AND s.is_published = TRUE
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Song not found' });
    res.json({ song: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/songs/upload (artists only)
router.post('/upload', authenticate, requireRole('artist'), upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, album_id, genre_id, lyrics, is_downloadable, is_premium, track_number } = req.body;
    if (!req.files?.audio) return res.status(400).json({ error: 'Audio file required' });
    if (!title) return res.status(400).json({ error: 'Title required' });

    const uuid = uuidv4();
    const filePath = req.files.audio[0].filename;
    const artworkPath = req.files?.artwork?.[0]?.filename || null;

    const [result] = await pool.execute(
      `INSERT INTO songs (uuid, artist_id, album_id, title, file_path, artwork, genre_id, lyrics, is_downloadable, is_premium, is_published, track_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,TRUE,?)`,
      [uuid, req.user.id, album_id || null, title, filePath, artworkPath, genre_id || null,
       lyrics || null, is_downloadable === 'true' ? 1 : 0, is_premium === 'true' ? 1 : 0, track_number || null]
    );

    res.status(201).json({ message: 'Song uploaded successfully', songId: result.insertId, uuid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/songs/:id/stream (record stream)
router.post('/:id/stream', optionalAuth, async (req, res) => {
  try {
    const [songs] = await pool.execute('SELECT * FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    const song = songs[0];

    await pool.execute('UPDATE songs SET stream_count = stream_count + 1 WHERE id = ?', [song.id]);
    await pool.execute(
      'INSERT INTO stream_history (user_id, song_id, ip_address) VALUES (?,?,?)',
      [req.user?.id || null, song.id, req.ip]
    );

    // Update artist earnings
    const period = new Date().toISOString().slice(0, 7);
    await pool.execute(
      `INSERT INTO earnings (artist_id, song_id, streams_count, amount, period)
       VALUES (?,?,1,?,?)
       ON DUPLICATE KEY UPDATE streams_count = streams_count + 1, amount = amount + ?`,
      [song.artist_id, song.id, RATE_PER_STREAM, period, RATE_PER_STREAM]
    );

    res.json({ message: 'Stream recorded' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/songs/:id/like
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.execute('SELECT id FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });

    const [existing] = await pool.execute('SELECT id FROM likes WHERE user_id = ? AND song_id = ?', [req.user.id, songs[0].id]);
    if (existing.length) {
      await pool.execute('DELETE FROM likes WHERE user_id = ? AND song_id = ?', [req.user.id, songs[0].id]);
      return res.json({ liked: false });
    }
    await pool.execute('INSERT INTO likes (user_id, song_id) VALUES (?,?)', [req.user.id, songs[0].id]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/songs/:id/download
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.execute('SELECT * FROM songs WHERE uuid = ? AND is_published = TRUE', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    const song = songs[0];

    if (!song.is_downloadable) return res.status(403).json({ error: 'Song not available for download' });

    // Check premium
    if (song.is_premium) {
      const [sub] = await pool.execute(
        'SELECT id FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date >= CURDATE() LIMIT 1',
        [req.user.id]
      );
      if (!sub.length) return res.status(403).json({ error: 'Premium subscription required to download' });
    }

    await pool.execute('UPDATE songs SET download_count = download_count + 1 WHERE id = ?', [song.id]);
    await pool.execute('INSERT INTO downloads (user_id, song_id) VALUES (?,?)', [req.user.id, song.id]);

    const filePath = path.join(__dirname, '..', 'uploads', 'songs', song.file_path);
    res.download(filePath, `${song.title}.mp3`);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/songs/artist/my-songs (artist dashboard)
router.get('/artist/my-songs', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const [songs] = await pool.execute(`
      SELECT s.*, g.name AS genre_name, al.title AS album_title,
        (SELECT COUNT(*) FROM likes WHERE song_id = s.id) AS like_count
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ?
      ORDER BY s.created_at DESC
    `, [req.user.id]);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/songs/:id
router.delete('/:id', authenticate, requireRole('artist', 'admin'), async (req, res) => {
  try {
    const [songs] = await pool.execute('SELECT * FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    if (req.user.role !== 'admin' && songs[0].artist_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    // Remove file
    const fp = path.join(__dirname, '..', 'uploads', 'songs', songs[0].file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);

    await pool.execute('DELETE FROM songs WHERE id = ?', [songs[0].id]);
    res.json({ message: 'Song deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
