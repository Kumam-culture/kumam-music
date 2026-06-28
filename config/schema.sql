-- ================================================================
-- ETOKWA MUSIC — FRESH DATABASE SCHEMA
-- Compatible with MySQL 8.0+ (Railway default)
-- Run this entire file to wipe and rebuild from scratch
-- ================================================================

-- Drop everything in correct order (respect foreign keys)
--SET FOREIGN_KEY_CHECKS = 0;

--DROP TABLE IF EXISTS notification_dismissals;
--DROP TABLE IF EXISTS notifications;
--DROP TABLE IF EXISTS share_links;
--DROP TABLE IF EXISTS donations;
--DROP TABLE IF EXISTS downloads;
--DROP TABLE IF EXISTS stream_history;
--DROP TABLE IF EXISTS earnings;
--DROP TABLE IF EXISTS password_resets;
--DROP TABLE IF EXISTS playlist_songs;
--DROP TABLE IF EXISTS likes;
--DROP TABLE IF EXISTS follows;
--DROP TABLE IF EXISTS subscriptions;
--DROP TABLE IF EXISTS songs;
--DROP TABLE IF EXISTS albums;
--DROP TABLE IF EXISTS playlists;
--DROP TABLE IF EXISTS artist_profiles;
--DROP TABLE IF EXISTS genres;
--DROP TABLE IF EXISTS genre_groups;
--DROP TABLE IF EXISTS users;

--SET FOREIGN_KEY_CHECKS = 1;

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE users (
  id                 INT           NOT NULL AUTO_INCREMENT,
  uuid               VARCHAR(36)   NOT NULL,
  name               VARCHAR(100)  NOT NULL,
  email              VARCHAR(150)  NOT NULL,
  password           VARCHAR(255)  NOT NULL,
  role               ENUM('listener','artist','admin') NOT NULL DEFAULT 'listener',
  avatar             VARCHAR(500)  DEFAULT NULL,
  bio                TEXT          DEFAULT NULL,
  phone              VARCHAR(20)   DEFAULT NULL,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  is_verified        TINYINT(1)    NOT NULL DEFAULT 0,
  terms_accepted     TINYINT(1)    NOT NULL DEFAULT 0,
  terms_accepted_at  TIMESTAMP     NULL DEFAULT NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_uuid  (uuid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── GENRE GROUPS (regions / styles) ─────────────────────────────
CREATE TABLE genre_groups (
  id          INT          NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  icon        VARCHAR(50)  DEFAULT NULL,
  color       VARCHAR(20)  DEFAULT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_genre_groups_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── GENRES ───────────────────────────────────────────────────────
CREATE TABLE genres (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  icon       VARCHAR(50)  DEFAULT NULL,
  color      VARCHAR(20)  DEFAULT NULL,
  group_id   INT          DEFAULT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_genres_slug (slug),
  CONSTRAINT fk_genres_group FOREIGN KEY (group_id) REFERENCES genre_groups (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ARTIST PROFILES ──────────────────────────────────────────────
CREATE TABLE artist_profiles (
  id                    INT          NOT NULL AUTO_INCREMENT,
  user_id               INT          NOT NULL,
  stage_name            VARCHAR(100) DEFAULT NULL,
  genre                 VARCHAR(100) DEFAULT NULL,
  location              VARCHAR(100) DEFAULT NULL,
  website               VARCHAR(200) DEFAULT NULL,
  social_instagram      VARCHAR(200) DEFAULT NULL,
  social_twitter        VARCHAR(200) DEFAULT NULL,
  total_streams         BIGINT       NOT NULL DEFAULT 0,
  total_earnings        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bank_name             VARCHAR(100) DEFAULT NULL,
  bank_account          VARCHAR(50)  DEFAULT NULL,
  mtn_number            VARCHAR(20)  DEFAULT NULL,
  airtel_number         VARCHAR(20)  DEFAULT NULL,
  payment_registered    TINYINT(1)   NOT NULL DEFAULT 0,
  payment_registered_at TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_artist_profiles_user (user_id),
  CONSTRAINT fk_artist_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ALBUMS ───────────────────────────────────────────────────────
CREATE TABLE albums (
  id           INT          NOT NULL AUTO_INCREMENT,
  uuid         VARCHAR(36)  NOT NULL,
  artist_id    INT          NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT         DEFAULT NULL,
  artwork      VARCHAR(500) DEFAULT NULL,
  genre_id     INT          DEFAULT NULL,
  release_date DATE         DEFAULT NULL,
  is_published TINYINT(1)   NOT NULL DEFAULT 0,
  total_streams BIGINT      NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_albums_uuid (uuid),
  CONSTRAINT fk_albums_artist FOREIGN KEY (artist_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_albums_genre  FOREIGN KEY (genre_id)  REFERENCES genres (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SONGS ────────────────────────────────────────────────────────
CREATE TABLE songs (
  id               INT          NOT NULL AUTO_INCREMENT,
  uuid             VARCHAR(36)  NOT NULL,
  artist_id        INT          NOT NULL,
  album_id         INT          DEFAULT NULL,
  title            VARCHAR(200) NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  artwork          VARCHAR(500) DEFAULT NULL,
  duration         INT          NOT NULL DEFAULT 0,
  genre_id         INT          DEFAULT NULL,
  lyrics           TEXT         DEFAULT NULL,
  is_downloadable  TINYINT(1)   NOT NULL DEFAULT 0,
  is_premium       TINYINT(1)   NOT NULL DEFAULT 0,
  is_published     TINYINT(1)   NOT NULL DEFAULT 0,
  stream_count     BIGINT       NOT NULL DEFAULT 0,
  download_count   INT          NOT NULL DEFAULT 0,
  track_number     INT          DEFAULT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_songs_uuid (uuid),
  CONSTRAINT fk_songs_artist FOREIGN KEY (artist_id) REFERENCES users (id)   ON DELETE CASCADE,
  CONSTRAINT fk_songs_album  FOREIGN KEY (album_id)  REFERENCES albums (id)  ON DELETE SET NULL,
  CONSTRAINT fk_songs_genre  FOREIGN KEY (genre_id)  REFERENCES genres (id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PLAYLISTS ────────────────────────────────────────────────────
CREATE TABLE playlists (
  id          INT          NOT NULL AUTO_INCREMENT,
  uuid        VARCHAR(36)  NOT NULL,
  creator_id  INT          DEFAULT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT         DEFAULT NULL,
  artwork     VARCHAR(500) DEFAULT NULL,
  is_public   TINYINT(1)   NOT NULL DEFAULT 1,
  is_system   TINYINT(1)   NOT NULL DEFAULT 0,
  total_songs INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_playlists_uuid (uuid),
  CONSTRAINT fk_playlists_creator FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PLAYLIST SONGS ───────────────────────────────────────────────
CREATE TABLE playlist_songs (
  id          INT       NOT NULL AUTO_INCREMENT,
  playlist_id INT       NOT NULL,
  song_id     INT       NOT NULL,
  position    INT       NOT NULL DEFAULT 0,
  added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_playlist_song (playlist_id, song_id),
  CONSTRAINT fk_ps_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_song     FOREIGN KEY (song_id)     REFERENCES songs (id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── LIKES ────────────────────────────────────────────────────────
CREATE TABLE likes (
  id         INT       NOT NULL AUTO_INCREMENT,
  user_id    INT       NOT NULL,
  song_id    INT       NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_likes (user_id, song_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_likes_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── FOLLOWS ──────────────────────────────────────────────────────
CREATE TABLE follows (
  id          INT       NOT NULL AUTO_INCREMENT,
  follower_id INT       NOT NULL,
  artist_id   INT       NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_follows (follower_id, artist_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_artist   FOREIGN KEY (artist_id)   REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SUBSCRIPTIONS ────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id               INT           NOT NULL AUTO_INCREMENT,
  user_id          INT           NOT NULL,
  plan             VARCHAR(60)   NOT NULL,
  status           ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'pending',
  amount           DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('mtn','airtel') NOT NULL,
  payment_phone    VARCHAR(20)   NOT NULL,
  transaction_ref  VARCHAR(100)  DEFAULT NULL,
  start_date       DATE          DEFAULT NULL,
  end_date         DATE          DEFAULT NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_ref (transaction_ref),
  CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── STREAM HISTORY ───────────────────────────────────────────────
CREATE TABLE stream_history (
  id         INT          NOT NULL AUTO_INCREMENT,
  user_id    INT          DEFAULT NULL,
  song_id    INT          NOT NULL,
  ip_address VARCHAR(45)  DEFAULT NULL,
  played_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stream_history_song (song_id),
  KEY idx_stream_history_user (user_id),
  CONSTRAINT fk_sh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_sh_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DOWNLOADS ────────────────────────────────────────────────────
CREATE TABLE downloads (
  id            INT       NOT NULL AUTO_INCREMENT,
  user_id       INT       NOT NULL,
  song_id       INT       NOT NULL,
  downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_dl_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── EARNINGS ─────────────────────────────────────────────────────
CREATE TABLE earnings (
  id            INT            NOT NULL AUTO_INCREMENT,
  artist_id     INT            NOT NULL,
  song_id       INT            NOT NULL DEFAULT 0,
  streams_count INT            NOT NULL DEFAULT 0,
  amount        DECIMAL(12,4)  NOT NULL DEFAULT 0.0000,
  period        VARCHAR(7)     NOT NULL,
  paid          TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_earnings_artist FOREIGN KEY (artist_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DONATIONS ────────────────────────────────────────────────────
CREATE TABLE donations (
  id               INT            NOT NULL AUTO_INCREMENT,
  uuid             VARCHAR(36)    NOT NULL,
  donor_id         INT            DEFAULT NULL,
  artist_id        INT            NOT NULL,
  amount           DECIMAL(10,2)  NOT NULL,
  admin_commission DECIMAL(10,2)  NOT NULL,
  artist_amount    DECIMAL(10,2)  NOT NULL,
  payment_method   ENUM('mtn','airtel') NOT NULL,
  payment_phone    VARCHAR(20)    NOT NULL,
  transaction_ref  VARCHAR(100)   DEFAULT NULL,
  message          TEXT           DEFAULT NULL,
  status           ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_donations_uuid (uuid),
  UNIQUE KEY uq_donations_ref  (transaction_ref),
  CONSTRAINT fk_donations_donor  FOREIGN KEY (donor_id)  REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_donations_artist FOREIGN KEY (artist_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE notifications (
  id          INT           NOT NULL AUTO_INCREMENT,
  uuid        VARCHAR(36)   NOT NULL,
  title       VARCHAR(200)  NOT NULL,
  message     TEXT          NOT NULL,
  color       ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  target      ENUM('all','listeners','artists') NOT NULL DEFAULT 'all',
  created_by  INT           NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_uuid (uuid),
  CONSTRAINT fk_notifications_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── NOTIFICATION DISMISSALS ──────────────────────────────────────
CREATE TABLE notification_dismissals (
  id              INT       NOT NULL AUTO_INCREMENT,
  notification_id INT       NOT NULL,
  user_id         INT       NOT NULL,
  dismissed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dismissal (notification_id, user_id),
  CONSTRAINT fk_nd_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE,
  CONSTRAINT fk_nd_user         FOREIGN KEY (user_id)         REFERENCES users (id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SHARE LINKS ──────────────────────────────────────────────────
CREATE TABLE share_links (
  id          INT          NOT NULL AUTO_INCREMENT,
  uuid        VARCHAR(36)  NOT NULL,
  type        ENUM('song','album','artist','playlist','site') NOT NULL,
  ref_uuid    VARCHAR(36)  DEFAULT NULL,
  ref_title   VARCHAR(200) DEFAULT NULL,
  click_count INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_share_links_uuid (uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PASSWORD RESETS ──────────────────────────────────────────────
CREATE TABLE password_resets (
  id         INT          NOT NULL AUTO_INCREMENT,
  user_id    INT          NOT NULL,
  token      VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- SEED DATA
-- ================================================================

-- ── Genre Groups ─────────────────────────────────────────────────
INSERT INTO genre_groups (name, slug, description, icon, color, sort_order) VALUES
  ('Northern Uganda',  'northern',      'Acholi, Lango, Alur & more',                 'map-marker-alt', '#F59E0B', 1),
  ('Eastern Uganda',   'eastern',       'Kumam, Ateso, Basoga, Bagisu & more',        'map-marker-alt', '#10B981', 2),
  ('West Nile',        'west-nile',     'Lugbara, Madi, Jopadhola & more',            'map-marker-alt', '#8B5CF6', 3),
  ('Central Uganda',   'central',       'Baganda, Banyankole & more',                 'map-marker-alt', '#EC4899', 4),
  ('Western Uganda',   'western',       'Banyankole, Batooro, Bakiga & more',         'map-marker-alt', '#3B82F6', 5),
  ('Church & Gospel',  'church-gospel', 'Praise, Worship & Inspirational',            'church',         '#A78BFA', 6),
  ('Traditional',      'traditional',   'Uganda Traditional & Cultural Songs',        'drum',           '#D97706', 7),
  ('Afro & Urban',     'afro-urban',    'Afrobeats, Bongo, Lingala & more',           'music',          '#EF4444', 8),
  ('International',    'international', 'Amapiano, RnB, Hip-Hop, Dancehall & more',  'globe',          '#6366F1', 9);

-- ── Genres ───────────────────────────────────────────────────────
-- Northern Uganda
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Acholi Music',    'acholi',    '#F59E0B', 1, 1),
  ('Lango Music',     'lango',     '#FBBF24', 1, 2),
  ('Alur Music',      'alur',      '#FCD34D', 1, 3),
  ('Kakwa Music',     'kakwa',     '#FDE68A', 1, 4);

-- Eastern Uganda
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Kumam Music',     'kumam',     '#10B981', 2, 1),
  ('Ateso Music',     'ateso',     '#34D399', 2, 2),
  ('Basoga Music',    'basoga',    '#6EE7B7', 2, 3),
  ('Bagisu Music',    'bagisu',    '#A7F3D0', 2, 4),
  ('Banyole Music',   'banyole',   '#D1FAE5', 2, 5);

-- West Nile
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Lugbara Music',   'lugbara',   '#8B5CF6', 3, 1),
  ('Madi Music',      'madi',      '#A78BFA', 3, 2),
  ('Jopadhola Music', 'jopadhola', '#C4B5FD', 3, 3),
  ('Aringa Music',    'aringa',    '#DDD6FE', 3, 4);

-- Central Uganda
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Luganda Music',   'luganda',    '#EC4899', 4, 1),
  ('Kiganda Music',   'kiganda',    '#F472B6', 4, 2),
  ('Banyankole',      'banyankole', '#FB7185', 4, 3);

-- Western Uganda
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Runyankore Music','runyankore', '#3B82F6', 5, 1),
  ('Rutooro Music',   'rutooro',   '#60A5FA', 5, 2),
  ('Rukiga Music',    'rukiga',    '#93C5FD', 5, 3),
  ('Bafumbira Music', 'bafumbira', '#BFDBFE', 5, 4);

-- Church & Gospel
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Gospel',               'gospel',         '#A78BFA', 6, 1),
  ('Praise & Worship',     'praise-worship', '#C4B5FD', 6, 2),
  ('Church Hymns',         'hymns',          '#DDD6FE', 6, 3),
  ('Contemporary Christian','ccm',           '#EDE9FE', 6, 4);

-- Traditional
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Uganda Traditional',  'ug-traditional', '#D97706', 7, 1),
  ('Cultural Dances',     'cultural-dance', '#B45309', 7, 2),
  ('Folklore Music',      'folklore',       '#92400E', 7, 3),
  ('Ndere Music',         'ndere',          '#78350F', 7, 4);

-- Afro & Urban
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Afrobeats',        'afrobeats',    '#EF4444', 8, 1),
  ('Afropop',          'afropop',      '#F87171', 8, 2),
  ('Bongo Flava',      'bongo',        '#FCA5A5', 8, 3),
  ('Lingala',          'lingala',      '#FECACA', 8, 4),
  ('Uganda Dancehall', 'ug-dancehall', '#FEE2E2', 8, 5),
  ('Gengetone',        'gengetone',    '#FECDD3', 8, 6);

-- International
INSERT INTO genres (name, slug, color, group_id, sort_order) VALUES
  ('Amapiano',   'amapiano',  '#6366F1', 9, 1),
  ('Hip-Hop',    'hiphop',    '#818CF8', 9, 2),
  ('RnB',        'rnb',       '#A5B4FC', 9, 3),
  ('Dancehall',  'dancehall', '#C7D2FE', 9, 4),
  ('Reggae',     'reggae',    '#A5F3FC', 9, 5),
  ('Pop',        'pop',       '#DDD6FE', 9, 6),
  ('Jazz & Soul','jazz-soul', '#E0E7FF', 9, 7);

-- ── Admin user (password: Admin@Etokwa2024) ───────────────────────
-- Hash generated for: Admin@Etokwa2024
INSERT INTO users (uuid, name, email, password, role, is_active, is_verified) VALUES (
  'admin-etokwa-uuid-001',
  'Etokwa Admin',
  'admin@etokwamusic.ug',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  1,
  1
);

-- ── System playlists ──────────────────────────────────────────────
INSERT INTO playlists (uuid, title, description, is_system, is_public) VALUES
  ('sys-trending-001',     'Trending',      'Top trending songs right now',         1, 1),
  ('sys-newrelease-001',   'New Releases',  'Fresh music just dropped',             1, 1),
  ('sys-gospel-001',       'Gospel Mix',    'Inspirational gospel collection',      1, 1),
  ('sys-top100-001',       'Top 100',       'The most streamed songs',              1, 1),
  ('sys-traditional-001',  'Traditional',   'Uganda cultural & traditional songs',  1, 1);

-- ================================================================
-- Done. Tables created, seed data inserted.
-- Default admin login:
--   Email:    admin@etokwamusic.ug
--   Password: Admin@Etokwa2024
-- ================================================================