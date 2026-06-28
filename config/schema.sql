-- Etokwa Music Streaming Platform - Database Schema
CREATE DATABASE IF NOT EXISTS kumam_music CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kumam_music;

-- Users table (listeners, artists, admin)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('listener','artist','admin') DEFAULT 'listener',
  avatar VARCHAR(255) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Artist profiles (extended info)
CREATE TABLE IF NOT EXISTS artist_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  stage_name VARCHAR(100) DEFAULT NULL,
  genre VARCHAR(100) DEFAULT NULL,
  location VARCHAR(100) DEFAULT NULL,
  website VARCHAR(200) DEFAULT NULL,
  social_instagram VARCHAR(200) DEFAULT NULL,
  social_twitter VARCHAR(200) DEFAULT NULL,
  total_streams BIGINT DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  bank_name VARCHAR(100) DEFAULT NULL,
  bank_account VARCHAR(50) DEFAULT NULL,
  mtn_number VARCHAR(20) DEFAULT NULL,
  airtel_number VARCHAR(20) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan ENUM('listener_basic','listener_premium','artist_annual') NOT NULL,
  status ENUM('pending','active','expired','cancelled') DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('mtn','airtel') NOT NULL,
  payment_phone VARCHAR(20) NOT NULL,
  transaction_ref VARCHAR(100) UNIQUE DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Genres
CREATE TABLE IF NOT EXISTS genres (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(50) DEFAULT NULL,
  color VARCHAR(20) DEFAULT NULL
);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  artist_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  artwork VARCHAR(255) DEFAULT NULL,
  genre_id INT DEFAULT NULL,
  release_date DATE DEFAULT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  total_streams BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

-- Songs
CREATE TABLE IF NOT EXISTS songs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  artist_id INT NOT NULL,
  album_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  artwork VARCHAR(255) DEFAULT NULL,
  duration INT DEFAULT 0,
  genre_id INT DEFAULT NULL,
  lyrics TEXT DEFAULT NULL,
  is_downloadable BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  stream_count BIGINT DEFAULT 0,
  download_count INT DEFAULT 0,
  track_number INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  creator_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  artwork VARCHAR(255) DEFAULT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,
  total_songs INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlist songs
CREATE TABLE IF NOT EXISTS playlist_songs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  playlist_id INT NOT NULL,
  song_id INT NOT NULL,
  position INT DEFAULT 0,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_playlist_song (playlist_id, song_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  song_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_like (user_id, song_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  id INT PRIMARY KEY AUTO_INCREMENT,
  follower_id INT NOT NULL,
  artist_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_follow (follower_id, artist_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stream history
CREATE TABLE IF NOT EXISTS stream_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  song_id INT NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Downloads
CREATE TABLE IF NOT EXISTS downloads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  song_id INT NOT NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Artist earnings per stream
CREATE TABLE IF NOT EXISTS earnings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  artist_id INT NOT NULL,
  song_id INT NOT NULL,
  streams_count INT DEFAULT 0,
  amount DECIMAL(10,4) DEFAULT 0.0000,
  period VARCHAR(7) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Default genres
INSERT IGNORE INTO genres (name, slug, icon, color) VALUES
  ('Gospel', 'gospel', 'music', '#8B5CF6'),
  ('Afrobeats', 'afrobeats', 'drum', '#F59E0B'),
  ('Hip-Hop', 'hiphop', 'microphone', '#EF4444'),
  ('Dancehall', 'dancehall', 'wave', '#10B981'),
  ('RnB', 'rnb', 'heart', '#EC4899');

-- Default admin user (password: Admin@Kumam2024)
INSERT IGNORE INTO users (uuid, name, email, password, role, is_active, is_verified)
VALUES (
  'admin-kumam-uuid-001',
  'Kumam Admin',
  'admin@etokwamusic.ug',
  '$2a$12$LqF5u8F.8FHbV2yqQs6qFO.Z0HJ.LV6VB/gPGZJLdALyZ3S.XLSaK',
  'admin',
  TRUE,
  TRUE
);

-- System playlists
INSERT IGNORE INTO playlists (uuid, title, description, is_system, is_public) VALUES
  ('sys-trending-001', 'Trending', 'Top trending songs right now', TRUE, TRUE),
  ('sys-new-releases-001', 'New Releases', 'Fresh music just dropped', TRUE, TRUE),
  ('sys-gospel-mix-001', 'Gospel Mix', 'Inspirational gospel collection', TRUE, TRUE),
  ('sys-top100-001', 'Top 100', 'The most streamed songs', TRUE, TRUE);

-- ── Admin Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  color ENUM('green','yellow','red') DEFAULT 'green',
  target ENUM('all','listeners','artists') DEFAULT 'all',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Track which users have dismissed which notifications
CREATE TABLE IF NOT EXISTS notification_dismissals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dismissal (notification_id, user_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Share links (track clicks) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS share_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  type ENUM('song','album','artist','playlist','site') NOT NULL,
  ref_uuid VARCHAR(36) DEFAULT NULL,
  ref_title VARCHAR(200) DEFAULT NULL,
  click_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Donations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  donor_id INT DEFAULT NULL,
  artist_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  admin_commission DECIMAL(10,2) NOT NULL,
  artist_amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('mtn','airtel') NOT NULL,
  payment_phone VARCHAR(20) NOT NULL,
  transaction_ref VARCHAR(100) UNIQUE DEFAULT NULL,
  message TEXT DEFAULT NULL,
  status ENUM('pending','completed','failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add terms_accepted to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL DEFAULT NULL;

-- Add payment_registered to artist_profiles (artist subscription for payment only)
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS payment_registered BOOLEAN DEFAULT FALSE;
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS payment_registered_at TIMESTAMP NULL DEFAULT NULL;

-- Update subscriptions plan enum to include listener tiers
ALTER TABLE subscriptions MODIFY COLUMN plan ENUM(
  'listener_basic','listener_premium','listener_premium_annual',
  'artist_payment_registration','artist_annual'
) NOT NULL;


-- ── Genre Groups (regional + style categories) ──────────────────
CREATE TABLE IF NOT EXISTS genre_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  icon VARCHAR(50) DEFAULT NULL,
  color VARCHAR(20) DEFAULT NULL,
  sort_order INT DEFAULT 0
);

-- Add group_id to genres table
ALTER TABLE genres ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL;
ALTER TABLE genres ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE genres ADD FOREIGN KEY IF NOT EXISTS (group_id) REFERENCES genre_groups(id) ON DELETE SET NULL;

-- ── Genre Groups ──────────────────────────────────────────────────
INSERT IGNORE INTO genre_groups (name, slug, description, icon, color, sort_order) VALUES
  ('Northern Uganda',  'northern',       'Acholi, Lango, Kumam, Alur & more',        'map-marker-alt', '#F59E0B', 1),
  ('Eastern Uganda',   'eastern',        'Kumam, Ateso, Basoga, Bagisu & more',       'map-marker-alt', '#10B981', 2),
  ('West Nile',        'west-nile',      'Lugbara, Madi, Jopadhola & more',           'map-marker-alt', '#8B5CF6', 3),
  ('Central Uganda',   'central',        'Baganda, Banyankole, Bafumbira & more',     'map-marker-alt', '#EC4899', 4),
  ('Western Uganda',   'western',        'Banyankole, Batooro, Bakiga & more',        'map-marker-alt', '#3B82F6', 5),
  ('Church & Gospel',  'church-gospel',  'Praise, Worship & Inspirational',           'church',         '#A78BFA', 6),
  ('Traditional',      'traditional',    'Uganda Traditional & Cultural Songs',       'drum',           '#D97706', 7),
  ('Afro & Urban',     'afro-urban',     'Afrobeats, Afropop, Bongo, Lingala & more', 'music',          '#EF4444', 8),
  ('International',    'international',  'Amapiano, RnB, Hip-Hop, Dancehall & more', 'globe',          '#6366F1', 9);

-- ── Clear old genres and replace with full set ───────────────────
DELETE FROM genres;

-- Northern Uganda
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Acholi Music',   'acholi',   'drum', '#F59E0B', (SELECT id FROM genre_groups WHERE slug='northern'), 1),
  ('Lango Music',    'lango',    'drum', '#FBBF24', (SELECT id FROM genre_groups WHERE slug='northern'), 2),
  ('Alur Music',     'alur',     'drum', '#FCD34D', (SELECT id FROM genre_groups WHERE slug='northern'), 3),
  ('Kakwa Music',    'kakwa',    'drum', '#FDE68A', (SELECT id FROM genre_groups WHERE slug='northern'), 4);

-- Eastern Uganda
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Etokwa Music',    'kumam',    'drum', '#10B981', (SELECT id FROM genre_groups WHERE slug='eastern'), 1),
  ('Ateso Music',    'ateso',    'drum', '#34D399', (SELECT id FROM genre_groups WHERE slug='eastern'), 2),
  ('Basoga Music',   'basoga',   'drum', '#6EE7B7', (SELECT id FROM genre_groups WHERE slug='eastern'), 3),
  ('Bagisu Music',   'bagisu',   'drum', '#A7F3D0', (SELECT id FROM genre_groups WHERE slug='eastern'), 4),
  ('Banyole Music',  'banyole',  'drum', '#D1FAE5', (SELECT id FROM genre_groups WHERE slug='eastern'), 5);

-- West Nile
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Lugbara Music',   'lugbara',   'drum', '#8B5CF6', (SELECT id FROM genre_groups WHERE slug='west-nile'), 1),
  ('Madi Music',      'madi',      'drum', '#A78BFA', (SELECT id FROM genre_groups WHERE slug='west-nile'), 2),
  ('Jopadhola Music', 'jopadhola', 'drum', '#C4B5FD', (SELECT id FROM genre_groups WHERE slug='west-nile'), 3),
  ('Aringa Music',    'aringa',    'drum', '#DDD6FE', (SELECT id FROM genre_groups WHERE slug='west-nile'), 4);

-- Central Uganda
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Luganda Music',  'luganda',  'music', '#EC4899', (SELECT id FROM genre_groups WHERE slug='central'), 1),
  ('Kiganda Music',  'kiganda',  'drum',  '#F472B6', (SELECT id FROM genre_groups WHERE slug='central'), 2),
  ('Banyankole',     'banyankole','drum', '#FB7185', (SELECT id FROM genre_groups WHERE slug='central'), 3);

-- Western Uganda
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Runyankore Music','runyankore','drum', '#3B82F6', (SELECT id FROM genre_groups WHERE slug='western'), 1),
  ('Rutooro Music',   'rutooro',   'drum', '#60A5FA', (SELECT id FROM genre_groups WHERE slug='western'), 2),
  ('Rukiga Music',    'rukiga',    'drum', '#93C5FD', (SELECT id FROM genre_groups WHERE slug='western'), 3),
  ('Bafumbira Music', 'bafumbira', 'drum', '#BFDBFE', (SELECT id FROM genre_groups WHERE slug='western'), 4);

-- Church & Gospel
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Gospel',          'gospel',         'church',     '#A78BFA', (SELECT id FROM genre_groups WHERE slug='church-gospel'), 1),
  ('Praise & Worship','praise-worship', 'hands',      '#C4B5FD', (SELECT id FROM genre_groups WHERE slug='church-gospel'), 2),
  ('Church Hymns',    'hymns',          'music',      '#DDD6FE', (SELECT id FROM genre_groups WHERE slug='church-gospel'), 3),
  ('Contemporary Christian','ccm',      'cross',      '#EDE9FE', (SELECT id FROM genre_groups WHERE slug='church-gospel'), 4);

-- Uganda Traditional
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Uganda Traditional','ug-traditional','drum',       '#D97706', (SELECT id FROM genre_groups WHERE slug='traditional'), 1),
  ('Cultural Dances',   'cultural-dance','person-dancing','B45309',(SELECT id FROM genre_groups WHERE slug='traditional'), 2),
  ('Folklore Music',    'folklore',      'leaf',       '#92400E', (SELECT id FROM genre_groups WHERE slug='traditional'), 3),
  ('Ndere Music',       'ndere',         'drum',       '#78350F', (SELECT id FROM genre_groups WHERE slug='traditional'), 4);

-- Afro & Urban
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Afrobeats',     'afrobeats',  'drum',       '#EF4444', (SELECT id FROM genre_groups WHERE slug='afro-urban'), 1),
  ('Afropop',       'afropop',    'music',      '#F87171', (SELECT id FROM genre_groups WHERE slug='afro-urban'), 2),
  ('Bongo Flava',   'bongo',      'music',      '#FCA5A5', (SELECT id FROM genre_groups WHERE slug='afro-urban'), 3),
  ('Lingala',       'lingala',    'music',      '#FECACA', (SELECT id FROM genre_groups WHERE slug='afro-urban'), 4),
  ('Uganda Dancehall','ug-dancehall','record-vinyl','#FEE2E2',(SELECT id FROM genre_groups WHERE slug='afro-urban'), 5),
  ('Gengetone',     'gengetone',  'microphone', '#FECDD3', (SELECT id FROM genre_groups WHERE slug='afro-urban'), 6);

-- International
INSERT IGNORE INTO genres (name, slug, icon, color, group_id, sort_order) VALUES
  ('Amapiano',      'amapiano',   'music',      '#6366F1', (SELECT id FROM genre_groups WHERE slug='international'), 1),
  ('Hip-Hop',       'hiphop',     'microphone', '#818CF8', (SELECT id FROM genre_groups WHERE slug='international'), 2),
  ('RnB',           'rnb',        'heart',      '#A5B4FC', (SELECT id FROM genre_groups WHERE slug='international'), 3),
  ('Dancehall',     'dancehall',  'record-vinyl','#C7D2FE',(SELECT id FROM genre_groups WHERE slug='international'), 4),
  ('Reggae',        'reggae',     'music',      '#DDD6FE', (SELECT id FROM genre_groups WHERE slug='international'), 5),
  ('Pop',           'pop',        'star',       '#E0E7FF', (SELECT id FROM genre_groups WHERE slug='international'), 6),
  ('Jazz & Soul',   'jazz-soul',  'music',      '#EEF2FF', (SELECT id FROM genre_groups WHERE slug='international'), 7);
