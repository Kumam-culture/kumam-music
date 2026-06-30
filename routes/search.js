const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

// GET /api/search?q=query
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { q, type = 'all', limit = 10 } = req.query;
    if (!q || q.trim().length < 1) return res.status(400).json({ error: 'Search query required' });
    const search = `%${q.trim()}%`;
    const lim = parseInt(limit);
    const results = {};

    if (type === 'all' || type === 'songs') {
      const [songs] = await pool.query(`
        SELECT s.uuid, s.title, s.artwork, s.stream_count, s.duration,
          u.name AS artist_name, ap.stage_name, g.name AS genre_name, al.artwork AS album_artwork
        FROM songs s
        JOIN users u ON s.artist_id = u.id
        LEFT JOIN artist_profiles ap ON u.id = ap.user_id
        LEFT JOIN genres g ON s.genre_id = g.id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE s.is_published = TRUE AND (s.title LIKE ? OR u.name LIKE ? OR ap.stage_name LIKE ?)
        ORDER BY s.stream_count DESC LIMIT ?
      `, [search, search, search, lim]);
      results.songs = songs;
    }

    if (type === 'all' || type === 'artists') {
      const [artists] = await pool.query(`
        SELECT u.uuid, u.name, u.avatar, ap.stage_name, t.name AS tribe_name,
          COUNT(DISTINCT f.follower_id) AS follower_count
        FROM users u
        JOIN artist_profiles ap ON u.id = ap.user_id
        LEFT JOIN tribes t ON ap.tribe_id = t.id
        LEFT JOIN follows f ON u.id = f.artist_id
        WHERE u.role = 'artist' AND u.is_active = TRUE
          AND (u.name LIKE ? OR ap.stage_name LIKE ? OR t.name LIKE ?)
        GROUP BY u.id
        ORDER BY follower_count DESC LIMIT ?
      `, [search, search, search, lim]);
      results.artists = artists;
    }

    if (type === 'all' || type === 'albums') {
      const [albums] = await pool.query(`
        SELECT al.uuid, al.title, al.artwork, al.release_date,
          u.name AS artist_name, ap.stage_name, COUNT(s.id) AS song_count
        FROM albums al
        JOIN users u ON al.artist_id = u.id
        LEFT JOIN artist_profiles ap ON u.id = ap.user_id
        LEFT JOIN songs s ON al.id = s.album_id AND s.is_published = TRUE
        WHERE al.is_published = TRUE AND (al.title LIKE ? OR u.name LIKE ?)
        GROUP BY al.id ORDER BY al.created_at DESC LIMIT ?
      `, [search, search, lim]);
      results.albums = albums;
    }

    if (type === 'all' || type === 'playlists') {
      const [playlists] = await pool.query(`
        SELECT p.uuid, p.title, p.artwork, p.total_songs,
          u.name AS creator_name, p.is_system
        FROM playlists p
        LEFT JOIN users u ON p.creator_id = u.id
        WHERE p.is_public = TRUE AND p.title LIKE ?
        ORDER BY p.is_system DESC, p.total_songs DESC LIMIT ?
      `, [search, lim]);
      results.playlists = playlists;
    }

    res.json({ query: q, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
