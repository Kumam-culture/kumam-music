const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const adminOnly = [authenticate, requireRole('admin')];

// GET /api/admin/dashboard
router.get('/dashboard', ...adminOnly, async (req, res) => {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role = "listener"');
    const [[artists]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role = "artist"');
    const [[songs]] = await pool.query('SELECT COUNT(*) AS total FROM songs WHERE is_published = TRUE');
    const [[streams]] = await pool.query('SELECT SUM(stream_count) AS total FROM songs');
    const [[revenue]] = await pool.query('SELECT SUM(amount) AS total FROM subscriptions WHERE status = "active"');
    const [[pendingSubs]] = await pool.query('SELECT COUNT(*) AS total FROM subscriptions WHERE status = "pending"');

    const [recentUsers] = await pool.query(
      'SELECT id, uuid, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 10'
    );
    const [topSongs] = await pool.query(
      'SELECT s.title, u.name AS artist_name, s.stream_count FROM songs s JOIN users u ON s.artist_id = u.id ORDER BY s.stream_count DESC LIMIT 10'
    );
    const [monthlyRevenue] = await pool.query(`
      SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, SUM(amount) AS revenue, COUNT(*) AS subscriptions
      FROM subscriptions WHERE status IN ('active','expired')
      GROUP BY month ORDER BY month DESC LIMIT 12
    `);

    res.json({
      stats: {
        totalListeners: users.total,
        totalArtists: artists.total,
        totalSongs: songs.total,
        totalStreams: streams.total || 0,
        totalRevenue: revenue.total || 0,
        pendingSubscriptions: pendingSubs.total
      },
      recentUsers,
      topSongs,
      monthlyRevenue
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT u.id, u.uuid, u.name, u.email, u.role, u.is_active, u.created_at,
        ap.stage_name, ap.total_streams,
        (SELECT COUNT(*) FROM subscriptions WHERE user_id = u.id AND status = 'active' AND end_date >= CURDATE()) AS has_active_sub
      FROM users u
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      WHERE u.role != 'admin'
    `;
    const params = [];
    if (role) { query += ' AND u.role = ?'; params.push(role); }
    if (search) { query += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [users] = await pool.query(query, params);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/users/:id/toggle-active
router.put('/users/:id/toggle-active', ...adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_active FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const newStatus = !rows[0].is_active;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'}`, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/songs
router.get('/songs', ...adminOnly, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT s.*, u.name AS artist_name, g.name AS genre_name
      FROM songs s JOIN users u ON s.artist_id = u.id
      LEFT JOIN genres g ON s.genre_id = g.id
    `;
    const params = [];
    if (search) { query += ' WHERE s.title LIKE ? OR u.name LIKE ?'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [songs] = await pool.query(query, params);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/songs/:id/toggle-published
router.put('/songs/:id/toggle-published', ...adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_published FROM songs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Song not found' });
    const newStatus = !rows[0].is_published;
    await pool.query('UPDATE songs SET is_published = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ message: `Song ${newStatus ? 'published' : 'unpublished'}` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/subscriptions
router.get('/subscriptions', ...adminOnly, async (req, res) => {
  try {
    const [subs] = await pool.query(`
      SELECT s.*, u.name AS user_name, u.email, u.role
      FROM subscriptions s JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 100
    `);
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/subscriptions/:id/approve
router.put('/subscriptions/:id/approve', ...adminOnly, async (req, res) => {
  try {
    const [subs] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
    if (!subs.length) return res.status(404).json({ error: 'Subscription not found' });
    const sub = subs[0];
    const startDate = new Date();
    const endDate = new Date();
    if (sub.plan === 'artist_annual') endDate.setFullYear(endDate.getFullYear() + 1);
    else if (sub.plan === 'listener_premium') endDate.setMonth(endDate.getMonth() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    await pool.query(
      'UPDATE subscriptions SET status = "active", start_date = ?, end_date = ? WHERE id = ?',
      [startDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10), sub.id]
    );

    // Activate artist account if pending
    if (sub.plan === 'artist_annual') {
      await pool.query('UPDATE users SET is_verified = TRUE WHERE id = ?', [sub.user_id]);
    }

    res.json({ message: 'Subscription approved and activated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/songs/:id
router.delete('/songs/:id', ...adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM songs WHERE id = ?', [req.params.id]);
    res.json({ message: 'Song deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ? AND role != "admin"', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/earnings
router.get('/earnings', ...adminOnly, async (req, res) => {
  try {
    const [earnings] = await pool.query(`
      SELECT e.*, u.name AS artist_name, s.title AS song_title
      FROM earnings e
      JOIN users u ON e.artist_id = u.id
      JOIN songs s ON e.song_id = s.id
      ORDER BY e.period DESC, e.amount DESC
    `);
    res.json({ earnings });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/genres
router.get('/genres', ...adminOnly, async (req, res) => {
  try {
    const [genres] = await pool.query('SELECT * FROM genres');
    res.json({ genres });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/genres
router.post('/genres', ...adminOnly, async (req, res) => {
  try {
    const { name, slug, icon, color } = req.body;
    await pool.query('INSERT INTO genres (name, slug, icon, color) VALUES (?,?,?,?)', [name, slug, icon, color]);
    res.status(201).json({ message: 'Genre added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/system-playlists/:id/refresh
router.post('/system-playlists/refresh', ...adminOnly, async (req, res) => {
  try {
    // Refresh trending playlist
    const [trending] = await pool.query('SELECT id FROM playlists WHERE title = "Trending" AND is_system = TRUE LIMIT 1');
    if (trending.length) {
      await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [trending[0].id]);
      const [topSongs] = await pool.query(
        'SELECT id FROM songs WHERE is_published = TRUE ORDER BY stream_count DESC LIMIT 20'
      );
      for (let i = 0; i < topSongs.length; i++) {
        await pool.query('INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?,?,?)',
          [trending[0].id, topSongs[i].id, i + 1]);
      }
    }

    // Refresh top 100
    const [top100] = await pool.query('SELECT id FROM playlists WHERE title = "Top 100" AND is_system = TRUE LIMIT 1');
    if (top100.length) {
      await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [top100[0].id]);
      const [topSongs] = await pool.query(
        'SELECT id FROM songs WHERE is_published = TRUE ORDER BY stream_count DESC LIMIT 100'
      );
      for (let i = 0; i < topSongs.length; i++) {
        await pool.query('INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?,?,?)',
          [top100[0].id, topSongs[i].id, i + 1]);
      }
    }

    res.json({ message: 'System playlists refreshed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
