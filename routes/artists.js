const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth');

const { uploadProfile } = require('../config/cloudinary');

// ── GET /api/artists/dashboard/stats  (BEFORE /:uuid) ──────────
router.get('/dashboard/stats', authenticate, requireRole('artist'), async (req, res) => {
  try {
    const uid = req.user.id;
    const [[songStats]]     = await pool.query(`SELECT COUNT(*) AS total_songs, COALESCE(SUM(stream_count),0) AS total_streams, COALESCE(SUM(download_count),0) AS total_downloads FROM songs WHERE artist_id = ? AND is_published = TRUE`, [uid]);
    const [[albumStats]]    = await pool.query(`SELECT COUNT(*) AS total_albums FROM albums WHERE artist_id = ?`, [uid]);
    const [[followerStats]] = await pool.query(`SELECT COUNT(*) AS total_followers FROM follows WHERE artist_id = ?`, [uid]);
    const [[earnings]]      = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_earnings FROM earnings WHERE artist_id = ?`, [uid]);
    const [topSongs]        = await pool.query(`SELECT s.title, s.stream_count, s.download_count, s.artwork, (SELECT COUNT(*) FROM likes WHERE song_id = s.id) AS likes FROM songs s WHERE s.artist_id = ? AND s.is_published = TRUE ORDER BY s.stream_count DESC LIMIT 5`, [uid]);
    const [monthlyStreams]  = await pool.query(`SELECT DATE_FORMAT(played_at,'%Y-%m') AS month, COUNT(*) AS streams FROM stream_history sh JOIN songs s ON sh.song_id = s.id WHERE s.artist_id = ? AND played_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`, [uid]);

    res.json({
      stats: {
        total_songs:      songStats.total_songs     || 0,
        total_streams:    songStats.total_streams   || 0,
        total_downloads:  songStats.total_downloads || 0,
        total_albums:     albumStats.total_albums   || 0,
        total_followers:  followerStats.total_followers || 0,
        total_earnings:   earnings.total_earnings   || 0
      },
      topSongs,
      monthlyStreams
    });
  } catch (err) {
    console.error('dashboard/stats error:', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/artists/profile  (BEFORE /:uuid) ──────────────────
router.put('/profile', authenticate, requireRole('artist'), uploadProfile.single('avatar'), async (req, res) => {
  try {
    const { name, bio, stage_name, region_id, tribe_id, location, website, social_instagram, social_twitter, mtn_number, airtel_number } = req.body;
    const avatarPath = req.file?.path || null; // Cloudinary secure_url

    const uCols = [], uVals = [];
    if (name)        { uCols.push('name = ?');   uVals.push(name); }
    if (bio !== undefined) { uCols.push('bio = ?'); uVals.push(bio); }
    if (avatarPath)  { uCols.push('avatar = ?'); uVals.push(avatarPath); }
    if (uCols.length) await pool.query(`UPDATE users SET ${uCols.join(',')} WHERE id = ?`, [...uVals, req.user.id]);

    const aCols = [], aVals = [];
    const apMap = {
      stage_name,
      region_id: region_id ? parseInt(region_id) : undefined,
      tribe_id:  tribe_id  ? parseInt(tribe_id)  : undefined,
      location, website, social_instagram, social_twitter, mtn_number, airtel_number
    };
    for (const [k, v] of Object.entries(apMap)) {
      if (v !== undefined) { aCols.push(`${k} = ?`); aVals.push(v); }
    }
    if (aCols.length) await pool.query(`UPDATE artist_profiles SET ${aCols.join(',')} WHERE user_id = ?`, [...aVals, req.user.id]);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/artists ────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit  = Math.max(1, Math.min(100, parseInt(req.query.limit)  || 20));
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const region = (req.query.region || '').trim();
    const tribe  = (req.query.tribe  || '').trim();
    const userId = req.user ? req.user.id : null;

    // Inline escape to avoid prepared-statement subquery bug
    const followingExpr = userId !== null
      ? `(SELECT COUNT(*) FROM follows WHERE follower_id = ${pool.escape(userId)} AND artist_id = u.id) AS is_following`
      : `0 AS is_following`;

    let where = "WHERE u.role = 'artist' AND u.is_active = TRUE";
    if (region) where += ` AND r.slug = ${pool.escape(region)}`;
    if (tribe)  where += ` AND t.slug = ${pool.escape(tribe)}`;

    const sql = `
      SELECT u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
        ap.stage_name, ap.location, ap.total_streams,
        r.name AS region_name, r.slug AS region_slug,
        t.name AS tribe_name,  t.slug AS tribe_slug,
        COUNT(DISTINCT s.id)          AS song_count,
        COUNT(DISTINCT al.id)         AS album_count,
        COUNT(DISTINCT f.follower_id) AS follower_count,
        ${followingExpr}
      FROM users u
      JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN regions r ON ap.region_id = r.id
      LEFT JOIN tribes  t ON ap.tribe_id  = t.id
      LEFT JOIN songs s  ON u.id = s.artist_id  AND s.is_published  = TRUE
      LEFT JOIN albums al ON u.id = al.artist_id AND al.is_published = TRUE
      LEFT JOIN follows f ON u.id = f.artist_id
      ${where}
      GROUP BY u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
               ap.stage_name, ap.location, ap.total_streams,
               r.name, r.slug, t.name, t.slug
      ORDER BY ap.total_streams DESC
      LIMIT ? OFFSET ?
    `;

    const [artists] = await pool.query(sql, [limit, offset]);
    res.json({ artists });
  } catch (err) {
    console.error('GET /artists error:', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/artists/:uuid ──────────────────────────────────────
router.get('/:uuid', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const followingExpr = userId !== null
      ? `(SELECT COUNT(*) FROM follows WHERE follower_id = ${pool.escape(userId)} AND artist_id = u.id) AS is_following`
      : `0 AS is_following`;

    const [rows] = await pool.query(`
      SELECT u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
        ap.stage_name, ap.location, ap.website,
        ap.social_instagram, ap.social_twitter, ap.total_streams,
        r.name AS region_name, r.slug AS region_slug,
        t.name AS tribe_name,  t.slug AS tribe_slug,
        COUNT(DISTINCT f.follower_id) AS follower_count,
        ${followingExpr}
      FROM users u
      JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN regions r ON ap.region_id = r.id
      LEFT JOIN tribes  t ON ap.tribe_id  = t.id
      LEFT JOIN follows f ON u.id = f.artist_id
      WHERE u.uuid = ? AND u.role = 'artist' AND u.is_active = TRUE
      GROUP BY u.id, u.uuid, u.name, u.avatar, u.bio, u.created_at,
               ap.stage_name, ap.location, ap.website,
               ap.social_instagram, ap.social_twitter, ap.total_streams,
               r.name, r.slug, t.name, t.slug
    `, [req.params.uuid]);

    if (!rows.length) return res.status(404).json({ error: 'Artist not found' });
    const artist = rows[0];

    const [songs] = await pool.query(`
      SELECT s.*, g.name AS genre_name, al.title AS album_title, al.artwork AS album_artwork
      FROM songs s
      LEFT JOIN genres g  ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ? AND s.is_published = TRUE
      ORDER BY s.stream_count DESC LIMIT 10
    `, [artist.id]);

    const [albums] = await pool.query(`
      SELECT al.*, COUNT(s.id) AS song_count
      FROM albums al LEFT JOIN songs s ON al.id = s.album_id
      WHERE al.artist_id = ? AND al.is_published = TRUE
      GROUP BY al.id ORDER BY al.created_at DESC
    `, [artist.id]);

    res.json({ artist, songs, albums });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/artists/:uuid/follow ─────────────────────────────
router.post('/:uuid/follow', authenticate, async (req, res) => {
  try {
    const [artists] = await pool.query('SELECT id FROM users WHERE uuid = ? AND role = "artist"', [req.params.uuid]);
    if (!artists.length) return res.status(404).json({ error: 'Artist not found' });
    if (artists[0].id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

    const [existing] = await pool.query(
      'SELECT id FROM follows WHERE follower_id = ? AND artist_id = ?', [req.user.id, artists[0].id]
    );
    if (existing.length) {
      await pool.query('DELETE FROM follows WHERE follower_id = ? AND artist_id = ?', [req.user.id, artists[0].id]);
      return res.json({ following: false });
    }
    await pool.query('INSERT INTO follows (follower_id, artist_id) VALUES (?,?)', [req.user.id, artists[0].id]);
    res.json({ following: true });
  } catch (err) {
    console.error(err.sqlMessage || err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
