const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const { uploadProfile } = require('../config/cloudinary');

// GET /api/users/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, uuid, name, email, role, avatar, bio, phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const [sub] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date >= CURDATE() LIMIT 1',
      [req.user.id]
    );
    res.json({ user: rows[0], subscription: sub[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/profile
router.put('/profile', authenticate, uploadProfile.single('avatar'), async (req, res) => {
  try {
    const { name, email, bio, phone, currentPassword, newPassword } = req.body;
    const avatarPath = req.file?.path || null; // Cloudinary secure_url

    // Verify password for credential changes
    if (email || newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required to update credentials' });
      const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
      const match = await bcrypt.compare(currentPassword, rows[0].password);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const updates = [];
    const vals = [];
    if (name) { updates.push('name = ?'); vals.push(name); }
    if (email) { updates.push('email = ?'); vals.push(email); }
    if (bio !== undefined) { updates.push('bio = ?'); vals.push(bio); }
    if (phone !== undefined) { updates.push('phone = ?'); vals.push(phone); }
    if (avatarPath) { updates.push('avatar = ?'); vals.push(avatarPath); }
    if (newPassword) {
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      updates.push('password = ?');
      vals.push(await bcrypt.hash(newPassword, 12));
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(',')} WHERE id = ?`, vals);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/liked-songs
router.get('/liked-songs', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.query(`
      SELECT s.*, u.name AS artist_name, ap.stage_name,
        g.name AS genre_name, al.title AS album_title, al.artwork AS album_artwork,
        1 AS liked, l.created_at AS liked_at
      FROM likes l
      JOIN songs s ON l.song_id = s.id
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE l.user_id = ? AND s.is_published = TRUE
      ORDER BY l.created_at DESC
    `, [req.user.id]);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/followed-artists
router.get('/followed-artists', authenticate, async (req, res) => {
  try {
    const [artists] = await pool.query(`
      SELECT u.id, u.uuid, u.name, u.avatar,
        ap.stage_name, t.name AS tribe_name, ap.total_streams,
        1 AS is_following, f.created_at AS followed_at
      FROM follows f
      JOIN users u ON f.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN tribes t ON ap.tribe_id = t.id
      WHERE f.follower_id = ? AND u.is_active = TRUE
      ORDER BY f.created_at DESC
    `, [req.user.id]);
    res.json({ artists });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/recommendations
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const [likedGenres] = await pool.query(`
      SELECT s.genre_id, COUNT(*) AS cnt
      FROM likes l JOIN songs s ON l.song_id = s.id
      WHERE l.user_id = ? AND s.genre_id IS NOT NULL
      GROUP BY s.genre_id ORDER BY cnt DESC LIMIT 3
    `, [req.user.id]);

    const [followedArtists] = await pool.query(
      'SELECT artist_id FROM follows WHERE follower_id = ?', [req.user.id]
    );

    const likedRows = (await pool.query('SELECT song_id FROM likes WHERE user_id = ?', [req.user.id]))[0];
    const likedSongIds = likedRows.map(r => r.song_id);
    const genreIds   = likedGenres.map(g => g.genre_id);
    const artistIds  = followedArtists.map(a => a.artist_id);

    let songs = [];

    // From followed artists — use pool.escape to avoid IN (?) prepared-stmt bug
    if (artistIds.length) {
      const artistIn   = artistIds.map(id => pool.escape(id)).join(',');
      const excludeStr = likedSongIds.length
        ? `AND s.id NOT IN (${likedSongIds.map(id => pool.escape(id)).join(',')})` : '';
      const [fromArtists] = await pool.query(`
        SELECT s.*, u.name AS artist_name, ap.stage_name,
          g.name AS genre_name, al.artwork AS album_artwork,
          'followed_artist' AS reason
        FROM songs s
        JOIN users u ON s.artist_id = u.id
        LEFT JOIN artist_profiles ap ON u.id = ap.user_id
        LEFT JOIN genres g ON s.genre_id = g.id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.artist_id IN (${artistIn}) AND s.is_published = TRUE
        ${excludeStr}
        ORDER BY s.stream_count DESC LIMIT 10
      `);
      songs.push(...fromArtists);
    }

    // From liked genres
    if (genreIds.length) {
      const genreIn = genreIds.map(id => pool.escape(id)).join(',');
      const [fromGenres] = await pool.query(`
        SELECT s.*, u.name AS artist_name, ap.stage_name,
          g.name AS genre_name, al.artwork AS album_artwork,
          'liked_genre' AS reason
        FROM songs s
        JOIN users u ON s.artist_id = u.id
        LEFT JOIN artist_profiles ap ON u.id = ap.user_id
        LEFT JOIN genres g ON s.genre_id = g.id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.genre_id IN (${genreIn}) AND s.is_published = TRUE
        ORDER BY s.stream_count DESC LIMIT 10
      `);
      songs.push(...fromGenres);
    }

    // Trending fallback
    const [trending] = await pool.query(`
      SELECT s.*, u.name AS artist_name, ap.stage_name,
        g.name AS genre_name, al.artwork AS album_artwork,
        'trending' AS reason
      FROM songs s
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.is_published = TRUE
      ORDER BY s.stream_count DESC LIMIT 20
    `);
    songs.push(...trending);

    const seen = new Set();
    const unique = songs.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    res.json({ songs: unique.slice(0, 20) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/history
router.get('/history', authenticate, async (req, res) => {
  try {
    const [songs] = await pool.query(`
      SELECT s.*, u.name AS artist_name, ap.stage_name, g.name AS genre_name,
        al.artwork AS album_artwork, MAX(sh.played_at) AS last_played
      FROM stream_history sh
      JOIN songs s ON sh.song_id = s.id
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE sh.user_id = ? AND s.is_published = TRUE
      GROUP BY s.id ORDER BY last_played DESC LIMIT 50
    `, [req.user.id]);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
