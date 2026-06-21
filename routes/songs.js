const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool    = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');
const { uploadSongFields, deleteAsset } = require('../config/cloudinary');

const RATE_PER_STREAM = 0.001;

// ── Helper: resolve artwork URL ──────────────────────────────────
// Stored value is either a full Cloudinary URL or legacy filename
const resolveUrl = (val, type = 'artwork') => {
  if (!val) return null;
  if (val.startsWith('http')) return val;
  return `/uploads/${type}/${val}`;
};

// ── GET /api/songs/artist/my-songs  (BEFORE /:id) ────────────────
router.get('/artist/my-songs', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const [songs] = await pool.query(`
      SELECT s.*, g.name AS genre_name, al.title AS album_title,
        (SELECT COUNT(*) FROM likes WHERE song_id = s.id) AS like_count
      FROM songs s
      LEFT JOIN genres g  ON s.genre_id  = g.id
      LEFT JOIN albums al ON s.album_id  = al.id
      WHERE s.artist_id = ?
      ORDER BY s.created_at DESC
    `, [req.user.id]);
    res.json({ songs });
  } catch (err) {
    console.error('my-songs:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/songs ────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit  = Math.max(1, Math.min(200, parseInt(req.query.limit)  || 20));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const genre  = (req.query.genre || '').trim();
    const sort   = req.query.sort || 'newest';
    const userId = req.user ? req.user.id : null;

    const likedExpr = userId !== null
      ? `(SELECT COUNT(*) FROM likes WHERE user_id = ${pool.escape(userId)} AND song_id = s.id) AS liked`
      : `0 AS liked`;

    let where = 'WHERE s.is_published = TRUE';
    if (genre) where += ` AND g.slug = ${pool.escape(genre)}`;

    const order = (sort === 'trending' || sort === 'popular')
      ? 's.stream_count DESC' : 's.created_at DESC';

    const [songs] = await pool.query(`
      SELECT s.*, u.name AS artist_name, u.avatar AS artist_avatar,
        ap.stage_name, g.name AS genre_name,
        al.title AS album_title, al.artwork AS album_artwork,
        ${likedExpr}
      FROM songs s
      JOIN users u  ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id  = ap.user_id
      LEFT JOIN genres g           ON s.genre_id  = g.id
      LEFT JOIN albums al          ON s.album_id  = al.id
      ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({ songs });
  } catch (err) {
    console.error('GET /songs:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/songs/:id ────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.name AS artist_name, u.avatar AS artist_avatar,
        ap.stage_name, g.name AS genre_name,
        al.title AS album_title, al.artwork AS album_artwork
      FROM songs s
      JOIN users u  ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g           ON s.genre_id = g.id
      LEFT JOIN albums al          ON s.album_id = al.id
      WHERE s.uuid = ? AND s.is_published = TRUE
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Song not found' });
    res.json({ song: rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/songs/upload ────────────────────────────────────────
router.post('/upload', authenticate, requireRole('artist'), (req, res, next) => {
  uploadSongFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { title, album_id, genre_id, lyrics, is_downloadable, is_premium, track_number } = req.body;
    if (!req.files?.audio?.[0]) return res.status(400).json({ error: 'Audio file required' });
    if (!title)                  return res.status(400).json({ error: 'Title required' });

    // Cloudinary returns secure_url (full URL)
    const filePath   = req.files.audio[0].path;           // full Cloudinary URL
    const artworkPath= req.files?.artwork?.[0]?.path || null;
    const uuid       = uuidv4();
    const albumIdVal = album_id    ? parseInt(album_id)    : null;
    const genreIdVal = genre_id    ? parseInt(genre_id)    : null;
    const trackNum   = track_number? parseInt(track_number): null;
    const downloadable = is_downloadable === 'true' ? 1 : 0;
    const premium      = is_premium      === 'true' ? 1 : 0;

    const [result] = await pool.query(
      `INSERT INTO songs
        (uuid,artist_id,album_id,title,file_path,artwork,genre_id,lyrics,is_downloadable,is_premium,is_published,track_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,TRUE,?)`,
      [uuid, req.user.id, albumIdVal, title, filePath, artworkPath,
       genreIdVal, lyrics||null, downloadable, premium, trackNum]
    );
    const newSongId = result.insertId;

    // Auto-add to New Releases + Trending system playlists
    try {
      const [sysPls] = await pool.query(
        "SELECT id, title FROM playlists WHERE is_system = TRUE AND title IN ('New Releases','Trending')"
      );
      for (const pl of sysPls) {
        const [[mx]] = await pool.query(
          'SELECT COALESCE(MAX(position),0) AS pos FROM playlist_songs WHERE playlist_id = ?', [pl.id]
        );
        await pool.query(
          'INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?,?,?)',
          [pl.id, newSongId, mx.pos + 1]
        );
        await pool.query('UPDATE playlists SET total_songs = total_songs + 1 WHERE id = ?', [pl.id]);
        if (pl.title === 'New Releases') {
          await pool.query(`
            DELETE FROM playlist_songs
            WHERE playlist_id = ?
              AND song_id NOT IN (
                SELECT song_id FROM (
                  SELECT song_id FROM playlist_songs
                  WHERE playlist_id = ? ORDER BY added_at DESC LIMIT 50
                ) t
              )`, [pl.id, pl.id]);
        }
      }
    } catch (plErr) {
      console.warn('System playlist update warning:', plErr.message);
    }

    res.status(201).json({ message: 'Song uploaded successfully', songId: newSongId, uuid });
  } catch (err) {
    console.error('upload error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/songs/:id/stream ────────────────────────────────────
router.post('/:id/stream', optionalAuth, async (req, res) => {
  try {
    const [songs] = await pool.query('SELECT * FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    const song = songs[0];
    await pool.query('UPDATE songs SET stream_count = stream_count + 1 WHERE id = ?', [song.id]);
    await pool.query(
      'INSERT INTO stream_history (user_id, song_id, ip_address) VALUES (?,?,?)',
      [req.user?.id || null, song.id, req.ip]
    );
    const period = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO earnings (artist_id, song_id, streams_count, amount, period)
       VALUES (?,?,1,?,?)
       ON DUPLICATE KEY UPDATE streams_count = streams_count + 1, amount = amount + ?`,
      [song.artist_id, song.id, RATE_PER_STREAM, period, RATE_PER_STREAM]
    );
    res.json({ message: 'Stream recorded' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/songs/:id/like ──────────────────────────────────────
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.query('SELECT id FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    const songId = songs[0].id;
    const [existing] = await pool.query(
      'SELECT id FROM likes WHERE user_id = ? AND song_id = ?', [req.user.id, songId]
    );
    if (existing.length) {
      await pool.query('DELETE FROM likes WHERE user_id = ? AND song_id = ?', [req.user.id, songId]);
      return res.json({ liked: false });
    }
    await pool.query('INSERT INTO likes (user_id, song_id) VALUES (?,?)', [req.user.id, songId]);
    res.json({ liked: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/songs/:id/download ───────────────────────────────────
// With Cloudinary, we redirect to the secure Cloudinary URL
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.query(
      'SELECT s.*, u.name AS artist_name, ap.stage_name FROM songs s JOIN users u ON s.artist_id = u.id LEFT JOIN artist_profiles ap ON u.id = ap.user_id WHERE s.uuid = ? AND s.is_published = TRUE',
      [req.params.id]
    );
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    const song = songs[0];
    if (!song.is_downloadable) return res.status(403).json({ error: 'Song not available for download' });
    if (song.is_premium) {
      const [sub] = await pool.query(
        'SELECT id FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date >= CURDATE() LIMIT 1',
        [req.user.id]
      );
      if (!sub.length) return res.status(403).json({ error: 'Premium subscription required' });
    }
    await pool.query('UPDATE songs SET download_count = download_count + 1 WHERE id = ?', [song.id]);
    await pool.query('INSERT INTO downloads (user_id, song_id) VALUES (?,?)', [req.user.id, song.id]);

    const artistName = (song.stage_name || song.artist_name || 'Artist').replace(/[^a-zA-Z0-9 ]/g,'').trim();
    const songTitle  = (song.title || 'Song').replace(/[^a-zA-Z0-9 ]/g,'').trim();
    const filename   = `Kumam_Music - ${artistName} - ${songTitle}.mp3`;

    // If stored as Cloudinary URL, redirect with download flag
    if (song.file_path && song.file_path.startsWith('http')) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.redirect(song.file_path);
    }

    // Legacy local file fallback
    const path = require('path');
    const filePath = path.join(__dirname, '..', 'uploads', 'songs', song.file_path);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filePath, filename);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/songs/:id ─────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('artist', 'admin'), async (req, res) => {
  try {
    const [songs] = await pool.query('SELECT * FROM songs WHERE uuid = ?', [req.params.id]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    if (req.user.role !== 'admin' && songs[0].artist_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized' });

    // Delete from Cloudinary
    await deleteAsset(songs[0].file_path,  'video');
    await deleteAsset(songs[0].artwork,    'image');

    await pool.query('DELETE FROM songs WHERE id = ?', [songs[0].id]);
    res.json({ message: 'Song deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
