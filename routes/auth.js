const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool    = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@etokwamusic.ug';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Etokwa2024';

// ── Phone validation (Uganda: 07xxxxxxxxx = 10 digits) ───────────
const validatePhone = (phone) => {
  if (!phone) return null; // phone is optional for listeners
  const clean = phone.replace(/[\s\-\+]/g, '');
  // Accept: 07xxxxxxxx (10 digits) or 2567xxxxxxxx (12 digits)
  if (!/^(07\d{8}|2567\d{8})$/.test(clean)) {
    return 'Phone number must start with 07 and be 10 digits (e.g. 0761234567)';
  }
  return null;
};

// ── POST /api/auth/login ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    // Auto-detect admin
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const isAdminPwd = password === ADMIN_PASSWORD ||
        await bcrypt.compare(password, await bcrypt.hash(ADMIN_PASSWORD, 12));
      if (!isAdminPwd) return res.status(401).json({ error: 'Invalid credentials' });
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ? AND role = "admin"', [email]
      );
      if (!rows.length) return res.status(401).json({ error: 'Admin not found' });
      const token = jwt.sign({ userId: rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({
        token,
        user: { id: rows[0].id, uuid: rows[0].uuid, name: rows[0].name, email: rows[0].email, role: 'admin', avatar: rows[0].avatar }
      });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1', [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: rows[0].id, role: rows[0].role }, JWT_SECRET, { expiresIn: '24h' });

    const [sub] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY created_at DESC LIMIT 1',
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
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/register (listeners) ─────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name)     return res.status(400).json({ error: 'Name is required' });
    if (!email)    return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Phone validation (optional for listeners, but if provided must be valid)
    if (phone) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) return res.status(400).json({ error: phoneErr });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'This email is already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const uuid   = uuidv4();
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
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/register-artist ──────────────────────────────
router.post('/register-artist', async (req, res) => {
  try {
    const { name, email, password, phone, stage_name, region_id, tribe_id, bio } = req.body;

    if (!name)     return res.status(400).json({ error: 'Name is required' });
    if (!email)    return res.status(400).json({ error: 'Email is required' });
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Phone is required for artists (needed for payments)
    if (!phone) return res.status(400).json({ error: 'Phone number is required for artists' });
    const phoneErr = validatePhone(phone);
    if (phoneErr) return res.status(400).json({ error: phoneErr });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'This email is already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const uuid   = uuidv4();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'INSERT INTO users (uuid, name, email, password, role, phone, bio) VALUES (?,?,?,?,?,?,?)',
        [uuid, name, email, hashed, 'artist', phone, bio || null]
      );
      const regionIdVal = region_id ? parseInt(region_id) : null;
      const tribeIdVal  = tribe_id  ? parseInt(tribe_id)  : null;
      await conn.query(
        'INSERT INTO artist_profiles (user_id, stage_name, region_id, tribe_id) VALUES (?,?,?,?)',
        [result.insertId, stage_name || name, regionIdVal, tribeIdVal]
      );
      await conn.commit();

      const token = jwt.sign({ userId: result.insertId, role: 'artist' }, JWT_SECRET, { expiresIn: '24h' });
      res.status(201).json({
        token,
        user: { id: result.insertId, uuid, name, email, role: 'artist', avatar: null },
        message: 'Artist account created. Register for payments to start earning.',
        requiresSubscription: true
      });
    } catch (e) {
      await conn.rollback(); throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('register-artist error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const [sub] = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active" AND (end_date IS NULL OR end_date >= CURDATE()) LIMIT 1',
      [req.user.id]
    );
    res.json({ user: { ...req.user, subscription: sub[0] || null } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match  = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
