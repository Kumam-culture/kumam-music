-- Kumam Music Streaming Platform - Database Schema
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
  'admin@kumammusic.ug',
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
