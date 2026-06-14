const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'kumam-music-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/songs', require('./routes/songs'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/search', require('./routes/search'));

// Serve main SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kumam Music streaming on port ${PORT}`);
});

module.exports = app;
