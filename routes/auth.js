const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kumammusic.ug';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Kumam2024';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Auto-detect admin
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const isAdminPwd = await bcrypt.compare(password, await bcrypt.hash(ADMIN_PASSWORD, 12)) ||
        password === ADMIN_PASSWORD;
      if (!isAdminPwd) return res.status(401).json({ error: 'Invalid credentials' });

      const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "admin"', [email]);
      if (!rows.length) return res.status(401).json({ error: 'Admin not found' });

      const token = jwt.sign({ userId: rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({
        token,
        user: { id: rows[0].id, uuid: rows[0].uuid, name: rows[0].name, email: rows[0].email, role: 'admin', avatar: rows[0].avatar }
      });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: rows[0].id, role: rows[0].role }, JWT_SECRET, { expiresIn: '24h' });

    // Get subscription status
    const [sub] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date >= CURDATE() ORDER BY end_date DESC LIMIT 1',
      [rows[0].id]
    );

    res.json({
      token,
      user: {
        id: rows[0].id, uuid: rows[0].uuid, name: rows[0].name,
        email: rows[0].email, role: rows[0].role, avatar: rows[0].avatar,
        subscription: sub[0] || null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register (listeners)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const uuid = uuidv4();
    const [result] = await pool.query(
      'INSERT INTO users (uuid, name, email, password, role, phone) VALUES (?,?,?,?,?,?)',
      [uuid, name, email, hashed, 'listener', phone || null]
    );

    const token = jwt.sign({ userId: result.insertId, role: 'listener' }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      token,
      user: { id: result.insertId, uuid, name, email, role: 'listener', avatar: null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register-artist
router.post('/register-artist', async (req, res) => {
  try {
    const { name, email, password, phone, stage_name, genre, bio } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const uuid = uuidv4();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'INSERT INTO users (uuid, name, email, password, role, phone, bio) VALUES (?,?,?,?,?,?,?)',
        [uuid, name, email, hashed, 'artist', phone || null, bio || null]
      );
      await conn.query(
        'INSERT INTO artist_profiles (user_id, stage_name, genre) VALUES (?,?,?)',
        [result.insertId, stage_name || name, genre || null]
      );
      await conn.commit();

      // Artist needs subscription to be fully active - pending until payment
      const token = jwt.sign({ userId: result.insertId, role: 'artist' }, JWT_SECRET, { expiresIn: '24h' });
      res.status(201).json({
        token,
        user: { id: result.insertId, uuid, name, email, role: 'artist', avatar: null },
        message: 'Artist account created. Please complete subscription payment to activate your account.',
        requiresSubscription: true
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [sub] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date >= CURDATE() LIMIT 1',
      [req.user.id]
    );
    res.json({ user: { ...req.user, subscription: sub[0] || null } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
