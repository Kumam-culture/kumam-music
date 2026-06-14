const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'kumam-jwt-secret-2024';

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.session?.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.execute(
      'SELECT id, uuid, name, email, role, avatar, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.userId]
    );

    if (!rows.length) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [rows] = await pool.execute(
        'SELECT id, uuid, name, email, role, avatar FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.userId]
      );
      if (rows.length) req.user = rows[0];
    }
  } catch (e) { /* ignore */ }
  next();
};

module.exports = { authenticate, requireRole, optionalAuth, JWT_SECRET };
