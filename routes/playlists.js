const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

// GET /api/playlists - system playlists
router.get('/', optionalAuth, async (req, res) => {
  try {
    const [playlists] = await pool.execute(`
      SELECT p.*, COUNT(ps.song_id) AS song_count,
        u.name AS creator_name
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      LEFT JOIN users u ON p.creator_id = u.id
      WHERE p.is_public = TRUE
      GROUP BY p.id ORDER BY p.is_system DESC, p.created_at DESC
    `);
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/playlists/:id/songs
router.get('/:id/songs', optionalAuth, async (req, res) => {
  try {
    const [playlists] = await pool.execute('SELECT * FROM playlists WHERE uuid = ?', [req.params.id]);
    if (!playlists.length) return res.status(404).json({ error: 'Playlist not found' });
    const pl = playlists[0];

    const [songs] = await pool.execute(`
      SELECT s.*, u.name AS artist_name, ap.stage_name, g.name AS genre_name,
        al.title AS album_title, al.artwork AS album_artwork, ps.position,
        ${req.user ? '(SELECT COUNT(*) FROM likes WHERE user_id = ? AND song_id = s.id) AS liked' : '0 AS liked'}
      FROM playlist_songs ps
      JOIN songs s ON ps.song_id = s.id
      JOIN users u ON s.artist_id = u.id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE ps.playlist_id = ? AND s.is_published = TRUE
      ORDER BY ps.position, ps.added_at
    `, req.user ? [req.user.id, pl.id] : [pl.id]);

    res.json({ playlist: pl, songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/playlists
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, is_public } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const uuid = uuidv4();
    const [result] = await pool.execute(
      'INSERT INTO playlists (uuid, creator_id, title, description, is_public) VALUES (?,?,?,?,?)',
      [uuid, req.user.id, title, description || null, is_public !== false ? 1 : 0]
    );
    res.status(201).json({ message: 'Playlist created', playlistId: result.insertId, uuid });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/playlists/:id/songs
router.post('/:id/songs', authenticate, async (req, res) => {
  try {
    const { song_uuid } = req.body;
    const [playlists] = await pool.execute(
      'SELECT * FROM playlists WHERE uuid = ? AND (creator_id = ? OR is_system = TRUE)',
      [req.params.id, req.user.id]
    );
    if (!playlists.length) return res.status(404).json({ error: 'Playlist not found' });

    const [songs] = await pool.execute('SELECT id FROM songs WHERE uuid = ?', [song_uuid]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });

    const [max] = await pool.execute('SELECT MAX(position) AS pos FROM playlist_songs WHERE playlist_id = ?', [playlists[0].id]);
    const position = (max[0].pos || 0) + 1;

    await pool.execute(
      'INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?,?,?)',
      [playlists[0].id, songs[0].id, position]
    );
    await pool.execute('UPDATE playlists SET total_songs = total_songs + 1 WHERE id = ?', [playlists[0].id]);
    res.json({ message: 'Song added to playlist' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/playlists/:id/songs/:songId
router.delete('/:id/songs/:songId', authenticate, async (req, res) => {
  try {
    const [playlists] = await pool.execute('SELECT * FROM playlists WHERE uuid = ? AND creator_id = ?', [req.params.id, req.user.id]);
    if (!playlists.length) return res.status(404).json({ error: 'Playlist not found or not authorized' });
    const [songs] = await pool.execute('SELECT id FROM songs WHERE uuid = ?', [req.params.songId]);
    if (!songs.length) return res.status(404).json({ error: 'Song not found' });
    await pool.execute('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlists[0].id, songs[0].id]);
    await pool.execute('UPDATE playlists SET total_songs = GREATEST(total_songs - 1, 0) WHERE id = ?', [playlists[0].id]);
    res.json({ message: 'Song removed from playlist' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/playlists/user/mine
router.get('/user/mine', authenticate, async (req, res) => {
  try {
    const [playlists] = await pool.execute(`
      SELECT p.*, COUNT(ps.song_id) AS song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      WHERE p.creator_id = ?
      GROUP BY p.id ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
