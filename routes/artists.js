const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'profiles')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/artists - list all artists
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0, genre } = req.query;
    let query = `
      SELECT u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
        ap.stage_name, ap.genre, ap.location, ap.total_streams,
        COUNT(DISTINCT s.id) AS song_count,
        COUNT(DISTINCT al.id) AS album_count,
        COUNT(DISTINCT f.follower_id) AS follower_count
        ${req.user ? ', (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND artist_id = u.id) AS is_following' : ', 0 AS is_following'}
      FROM users u
      JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN songs s ON u.id = s.artist_id AND s.is_published = TRUE
      LEFT JOIN albums al ON u.id = al.artist_id AND al.is_published = TRUE
      LEFT JOIN follows f ON u.id = f.artist_id
      WHERE u.role = 'artist' AND u.is_active = TRUE
    `;
    const params = req.user ? [req.user.id] : [];
    if (genre) { query += ' AND ap.genre LIKE ?'; params.push(`%${genre}%`); }
    query += ' GROUP BY u.id ORDER BY ap.total_streams DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [artists] = await pool.execute(query, params);
    res.json({ artists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/artists/:uuid
router.get('/:uuid', optionalAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
        ap.stage_name, ap.genre, ap.location, ap.website,
        ap.social_instagram, ap.social_twitter, ap.total_streams,
        COUNT(DISTINCT f.follower_id) AS follower_count
        ${req.user ? ', (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND artist_id = u.id) AS is_following' : ', 0 AS is_following'}
      FROM users u
      JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN follows f ON u.id = f.artist_id
      WHERE u.uuid = ? AND u.role = 'artist' AND u.is_active = TRUE
      GROUP BY u.id
    `, req.user ? [req.user.id, req.params.uuid] : [req.params.uuid]);
    if (!rows.length) return res.status(404).json({ error: 'Artist not found' });

    const artist = rows[0];
    const [songs] = await pool.execute(`
      SELECT s.*, g.name AS genre_name, al.title AS album_title, al.artwork AS album_artwork
      FROM songs s
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ? AND s.is_published = TRUE
      ORDER BY s.stream_count DESC LIMIT 10
    `, [artist.id]);

    const [albums] = await pool.execute(`
      SELECT al.*, COUNT(s.id) AS song_count
      FROM albums al LEFT JOIN songs s ON al.id = s.album_id
      WHERE al.artist_id = ? AND al.is_published = TRUE
      GROUP BY al.id ORDER BY al.created_at DESC
    `, [artist.id]);

    res.json({ artist, songs, albums });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/artists/:uuid/follow
router.post('/:uuid/follow', authenticate, async (req, res) => {
  try {
    const [artists] = await pool.execute('SELECT id FROM users WHERE uuid = ? AND role = "artist"', [req.params.uuid]);
    if (!artists.length) return res.status(404).json({ error: 'Artist not found' });
    if (artists[0].id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

    const [existing] = await pool.execute('SELECT id FROM follows WHERE follower_id = ? AND artist_id = ?', [req.user.id, artists[0].id]);
    if (existing.length) {
      await pool.execute('DELETE FROM follows WHERE follower_id = ? AND artist_id = ?', [req.user.id, artists[0].id]);
      return res.json({ following: false });
    }
    await pool.execute('INSERT INTO follows (follower_id, artist_id) VALUES (?,?)', [req.user.id, artists[0].id]);
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/artists/dashboard/stats (artist own stats)
router.get('/dashboard/stats', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const [songStats] = await pool.execute(`
      SELECT COUNT(*) AS total_songs, SUM(stream_count) AS total_streams,
        SUM(download_count) AS total_downloads
      FROM songs WHERE artist_id = ? AND is_published = TRUE
    `, [req.user.id]);

    const [albumStats] = await pool.execute(
      'SELECT COUNT(*) AS total_albums FROM albums WHERE artist_id = ?', [req.user.id]
    );

    const [followerStats] = await pool.execute(
      'SELECT COUNT(*) AS total_followers FROM follows WHERE artist_id = ?', [req.user.id]
    );

    const [earnings] = await pool.execute(
      'SELECT SUM(amount) AS total_earnings, SUM(streams_count) AS total_streams FROM earnings WHERE artist_id = ?',
      [req.user.id]
    );

    const [topSongs] = await pool.execute(`
      SELECT s.title, s.stream_count, s.download_count, s.artwork,
        (SELECT COUNT(*) FROM likes WHERE song_id = s.id) AS likes
      FROM songs s WHERE s.artist_id = ? AND s.is_published = TRUE
      ORDER BY s.stream_count DESC LIMIT 5
    `, [req.user.id]);

    const [monthlyStreams] = await pool.execute(`
      SELECT DATE_FORMAT(played_at,'%Y-%m') AS month, COUNT(*) AS streams
      FROM stream_history sh
      JOIN songs s ON sh.song_id = s.id
      WHERE s.artist_id = ? AND played_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `, [req.user.id]);

    res.json({
      stats: {
        ...songStats[0],
        ...albumStats[0],
        ...followerStats[0],
        total_earnings: earnings[0]?.total_earnings || 0
      },
      topSongs,
      monthlyStreams
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/artists/profile (update artist profile)
router.put('/profile', authenticate, requireRole('artist'), upload.single('avatar'), async (req, res) => {
  try {
    const { name, bio, stage_name, genre, location, website, social_instagram, social_twitter, mtn_number, airtel_number } = req.body;
    const avatarPath = req.file?.filename || null;

    if (name || avatarPath !== undefined) {
      const updates = [];
      const vals = [];
      if (name) { updates.push('name = ?'); vals.push(name); }
      if (avatarPath) { updates.push('avatar = ?'); vals.push(avatarPath); }
      if (updates.length) {
        vals.push(req.user.id);
        await pool.execute(`UPDATE users SET ${updates.join(',')} WHERE id = ?`, vals);
      }
    }

    const apUpdates = [];
    const apVals = [];
    if (stage_name !== undefined) { apUpdates.push('stage_name = ?'); apVals.push(stage_name); }
    if (genre !== undefined) { apUpdates.push('genre = ?'); apVals.push(genre); }
    if (location !== undefined) { apUpdates.push('location = ?'); apVals.push(location); }
    if (website !== undefined) { apUpdates.push('website = ?'); apVals.push(website); }
    if (social_instagram !== undefined) { apUpdates.push('social_instagram = ?'); apVals.push(social_instagram); }
    if (social_twitter !== undefined) { apUpdates.push('social_twitter = ?'); apVals.push(social_twitter); }
    if (mtn_number !== undefined) { apUpdates.push('mtn_number = ?'); apVals.push(mtn_number); }
    if (airtel_number !== undefined) { apUpdates.push('airtel_number = ?'); apVals.push(airtel_number); }

    if (apUpdates.length) {
      apVals.push(req.user.id);
      await pool.execute(`UPDATE artist_profiles SET ${apUpdates.join(',')} WHERE user_id = ?`, apVals);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
