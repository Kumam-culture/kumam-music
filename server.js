const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Trust Railway/Heroku proxy for correct IPs and HTTPS detection
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Only serve /uploads locally — in production all assets are on Cloudinary
if (!isProd) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'kumam-music-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,   // HTTPS-only cookies in production
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ── Health check (Railway uses this) ────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date().toISOString() });
});

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/songs',         require('./routes/songs'));
app.use('/api/albums',        require('./routes/albums'));
app.use('/api/playlists',     require('./routes/playlists'));
app.use('/api/artists',       require('./routes/artists'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/share',         require('./routes/share'));

// Public genre groups (no auth needed)
const pool = require('./config/database');
app.get('/api/genre-groups', async (req, res) => {
  try {
    const [groups] = await pool.query('SELECT * FROM genre_groups ORDER BY sort_order');
    const [genres] = await pool.query(`
      SELECT g.*, gg.name AS group_name, gg.slug AS group_slug, gg.color AS group_color
      FROM genres g
      LEFT JOIN genre_groups gg ON g.group_id = gg.id
      ORDER BY g.group_id, g.sort_order
    `);
    res.json({ groups, genres });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🥁 Etokwa Music running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
