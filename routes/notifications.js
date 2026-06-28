const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/notifications — get active notifications for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    // target: 'all' shows to everyone, 'listeners'/'artists' to that role only
    const [notifications] = await pool.query(`
      SELECT n.*,
        u.name AS created_by_name
      FROM notifications n
      JOIN users u ON n.created_by = u.id
      WHERE (n.target = 'all' OR n.target = ?)
        AND n.id NOT IN (
          SELECT notification_id FROM notification_dismissals WHERE user_id = ?
        )
      ORDER BY n.created_at DESC
    `, [role === 'admin' ? 'all' : role + 's', req.user.id]);
    // Map role correctly: listener -> listeners, artist -> artists
    res.json({ notifications });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/:id/dismiss — user dismisses a notification
router.post('/:id/dismiss', authenticate, async (req, res) => {
  try {
    await pool.query(
      'INSERT IGNORE INTO notification_dismissals (notification_id, user_id) VALUES (?,?)',
      [req.params.id, req.user.id]
    );
    res.json({ dismissed: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications — admin creates notification
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { title, message, color, target } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message required' });
    const validColors  = ['green', 'yellow', 'red'];
    const validTargets = ['all', 'listeners', 'artists'];
    if (!validColors.includes(color))   return res.status(400).json({ error: 'Invalid color' });
    if (!validTargets.includes(target)) return res.status(400).json({ error: 'Invalid target' });

    const uuid = uuidv4();
    const [result] = await pool.query(
      'INSERT INTO notifications (uuid, title, message, color, target, created_by) VALUES (?,?,?,?,?,?)',
      [uuid, title, message, color, target, req.user.id]
    );
    res.status(201).json({ message: 'Notification sent', id: result.insertId, uuid });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id — admin deletes notification
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications/admin/all — admin sees all notifications
router.get('/admin/all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [notifications] = await pool.query(`
      SELECT n.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM notification_dismissals WHERE notification_id = n.id) AS dismiss_count
      FROM notifications n
      JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC
    `);
    res.json({ notifications });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
