-- ================================================================
-- ETOKWA MUSIC — FRESH DATABASE SCHEMA v2
-- Region → Tribe → Genre hierarchy
-- Compatible with MySQL 8.0+ (Railway)
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notification_dismissals;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS share_links;
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS downloads;
DROP TABLE IF EXISTS stream_history;
DROP TABLE IF EXISTS earnings;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS playlist_songs;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS songs;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS artist_profiles;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS tribes;
DROP TABLE IF EXISTS regions;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

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
  region_id          INT           DEFAULT NULL,
  tribe_id           INT           DEFAULT NULL,
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

-- ── REGIONS ──────────────────────────────────────────────────────
CREATE TABLE regions (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  DEFAULT '#F59E0B',
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_regions_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── TRIBES ───────────────────────────────────────────────────────
CREATE TABLE tribes (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  region_id  INT          NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tribes_slug (slug),
  CONSTRAINT fk_tribes_region FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── GENRES (music styles — universal, not tied to region) ────────
CREATE TABLE genres (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  DEFAULT '#E8820C',
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_genres_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ARTIST PROFILES ──────────────────────────────────────────────
CREATE TABLE artist_profiles (
  id                    INT           NOT NULL AUTO_INCREMENT,
  user_id               INT           NOT NULL,
  stage_name            VARCHAR(100)  DEFAULT NULL,
  region_id             INT           DEFAULT NULL,
  tribe_id              INT           DEFAULT NULL,
  genre_id              INT           DEFAULT NULL,
  location              VARCHAR(100)  DEFAULT NULL,
  website               VARCHAR(200)  DEFAULT NULL,
  social_instagram      VARCHAR(200)  DEFAULT NULL,
  social_twitter        VARCHAR(200)  DEFAULT NULL,
  total_streams         BIGINT        NOT NULL DEFAULT 0,
  total_earnings        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bank_name             VARCHAR(100)  DEFAULT NULL,
  bank_account          VARCHAR(50)   DEFAULT NULL,
  mtn_number            VARCHAR(20)   DEFAULT NULL,
  airtel_number         VARCHAR(20)   DEFAULT NULL,
  payment_registered    TINYINT(1)    NOT NULL DEFAULT 0,
  payment_registered_at TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ap_user (user_id),
  CONSTRAINT fk_ap_user   FOREIGN KEY (user_id)   REFERENCES users   (id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_region FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE SET NULL,
  CONSTRAINT fk_ap_tribe  FOREIGN KEY (tribe_id)  REFERENCES tribes  (id) ON DELETE SET NULL,
  CONSTRAINT fk_ap_genre  FOREIGN KEY (genre_id)  REFERENCES genres  (id) ON DELETE SET NULL
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
  region_id    INT          DEFAULT NULL,
  tribe_id     INT          DEFAULT NULL,
  release_date DATE         DEFAULT NULL,
  is_published TINYINT(1)   NOT NULL DEFAULT 0,
  total_streams BIGINT      NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_albums_uuid (uuid),
  CONSTRAINT fk_albums_artist  FOREIGN KEY (artist_id) REFERENCES users   (id) ON DELETE CASCADE,
  CONSTRAINT fk_albums_genre   FOREIGN KEY (genre_id)  REFERENCES genres  (id) ON DELETE SET NULL,
  CONSTRAINT fk_albums_region  FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE SET NULL,
  CONSTRAINT fk_albums_tribe   FOREIGN KEY (tribe_id)  REFERENCES tribes  (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SONGS ────────────────────────────────────────────────────────
CREATE TABLE songs (
  id              INT          NOT NULL AUTO_INCREMENT,
  uuid            VARCHAR(36)  NOT NULL,
  artist_id       INT          NOT NULL,
  album_id        INT          DEFAULT NULL,
  title           VARCHAR(200) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  artwork         VARCHAR(500) DEFAULT NULL,
  duration        INT          NOT NULL DEFAULT 0,
  genre_id        INT          DEFAULT NULL,
  region_id       INT          DEFAULT NULL,
  tribe_id        INT          DEFAULT NULL,
  lyrics          TEXT         DEFAULT NULL,
  is_downloadable TINYINT(1)   NOT NULL DEFAULT 0,
  is_premium      TINYINT(1)   NOT NULL DEFAULT 0,
  is_published    TINYINT(1)   NOT NULL DEFAULT 0,
  stream_count    BIGINT       NOT NULL DEFAULT 0,
  download_count  INT          NOT NULL DEFAULT 0,
  track_number    INT          DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_songs_uuid (uuid),
  KEY idx_songs_genre  (genre_id),
  KEY idx_songs_region (region_id),
  KEY idx_songs_tribe  (tribe_id),
  CONSTRAINT fk_songs_artist FOREIGN KEY (artist_id) REFERENCES users   (id) ON DELETE CASCADE,
  CONSTRAINT fk_songs_album  FOREIGN KEY (album_id)  REFERENCES albums  (id) ON DELETE SET NULL,
  CONSTRAINT fk_songs_genre  FOREIGN KEY (genre_id)  REFERENCES genres  (id) ON DELETE SET NULL,
  CONSTRAINT fk_songs_region FOREIGN KEY (region_id) REFERENCES regions (id) ON DELETE SET NULL,
  CONSTRAINT fk_songs_tribe  FOREIGN KEY (tribe_id)  REFERENCES tribes  (id) ON DELETE SET NULL
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
  UNIQUE KEY uq_ps (playlist_id, song_id),
  CONSTRAINT fk_ps_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_song     FOREIGN KEY (song_id)     REFERENCES songs     (id) ON DELETE CASCADE
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
  id              INT           NOT NULL AUTO_INCREMENT,
  user_id         INT           NOT NULL,
  plan            VARCHAR(60)   NOT NULL,
  status          ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'pending',
  amount          DECIMAL(10,2) NOT NULL,
  payment_method  ENUM('mtn','airtel') NOT NULL,
  payment_phone   VARCHAR(20)   NOT NULL,
  transaction_ref VARCHAR(100)  DEFAULT NULL,
  start_date      DATE          DEFAULT NULL,
  end_date        DATE          DEFAULT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subs_ref (transaction_ref),
  CONSTRAINT fk_subs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── STREAM HISTORY ───────────────────────────────────────────────
CREATE TABLE stream_history (
  id         INT         NOT NULL AUTO_INCREMENT,
  user_id    INT         DEFAULT NULL,
  song_id    INT         NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  played_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sh_song (song_id),
  KEY idx_sh_user (user_id),
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
  id            INT           NOT NULL AUTO_INCREMENT,
  artist_id     INT           NOT NULL,
  song_id       INT           NOT NULL DEFAULT 0,
  streams_count INT           NOT NULL DEFAULT 0,
  amount        DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  period        VARCHAR(7)    NOT NULL,
  paid          TINYINT(1)    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_earn_artist FOREIGN KEY (artist_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DONATIONS ────────────────────────────────────────────────────
CREATE TABLE donations (
  id               INT           NOT NULL AUTO_INCREMENT,
  uuid             VARCHAR(36)   NOT NULL,
  donor_id         INT           DEFAULT NULL,
  artist_id        INT           NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  admin_commission DECIMAL(10,2) NOT NULL,
  artist_amount    DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('mtn','airtel') NOT NULL,
  payment_phone    VARCHAR(20)   NOT NULL,
  transaction_ref  VARCHAR(100)  DEFAULT NULL,
  message          TEXT          DEFAULT NULL,
  status           ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_don_uuid (uuid),
  UNIQUE KEY uq_don_ref  (transaction_ref),
  CONSTRAINT fk_don_donor  FOREIGN KEY (donor_id)  REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_don_artist FOREIGN KEY (artist_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE notifications (
  id         INT          NOT NULL AUTO_INCREMENT,
  uuid       VARCHAR(36)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,
  color      ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  target     ENUM('all','listeners','artists') NOT NULL DEFAULT 'all',
  created_by INT          NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notif_uuid (uuid),
  CONSTRAINT fk_notif_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── NOTIFICATION DISMISSALS ──────────────────────────────────────
CREATE TABLE notification_dismissals (
  id              INT       NOT NULL AUTO_INCREMENT,
  notification_id INT       NOT NULL,
  user_id         INT       NOT NULL,
  dismissed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nd (notification_id, user_id),
  CONSTRAINT fk_nd_notif FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE,
  CONSTRAINT fk_nd_user  FOREIGN KEY (user_id)         REFERENCES users          (id) ON DELETE CASCADE
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
  UNIQUE KEY uq_share_uuid (uuid)
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

-- ── Regions ──────────────────────────────────────────────────────
INSERT INTO regions (name, slug, color, sort_order) VALUES
  ('Northern Uganda', 'northern', '#F59E0B', 1),
  ('Eastern Uganda',  'eastern',  '#10B981', 2),
  ('West Nile',       'west-nile','#8B5CF6', 3),
  ('Central Uganda',  'central',  '#EC4899', 4),
  ('Western Uganda',  'western',  '#3B82F6', 5),
  ('International',   'international', '#6366F1', 6);

-- ── Tribes ───────────────────────────────────────────────────────
-- Northern Uganda (region_id = 1)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('Acholi',    'acholi',    1, 1),
  ('Langi',     'langi',     1, 2),
  ('Alur',      'alur',      1, 3),
  ('Kakwa',     'kakwa',     1, 4),
  ('Madi',      'madi',      1, 5),
  ('Others',    'northern-others', 1, 99);

-- Eastern Uganda (region_id = 2)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('Kumam',     'kumam',     2, 1),
  ('Ateso',     'ateso',     2, 2),
  ('Basoga',    'basoga',    2, 3),
  ('Bagisu',    'bagisu',    2, 4),
  ('Banyole',   'banyole',   2, 5),
  ('Bamasaba',  'bamasaba',  2, 6),
  ('Others',    'eastern-others', 2, 99);

-- West Nile (region_id = 3)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('Lugbara',   'lugbara',   3, 1),
  ('Jopadhola', 'jopadhola', 3, 2),
  ('Aringa',    'aringa',    3, 3),
  ('Lendu',     'lendu',     3, 4),
  ('Others',    'westnile-others', 3, 99);

-- Central Uganda (region_id = 4)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('Baganda',   'baganda',   4, 1),
  ('Banyankole','banyankole',4, 2),
  ('Basoga',    'basoga-c',  4, 3),
  ('Batoro',    'batoro',    4, 4),
  ('Others',    'central-others', 4, 99);

-- Western Uganda (region_id = 5)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('Banyankole','banyankole-w', 5, 1),
  ('Batooro',   'batooro',   5, 2),
  ('Bakiga',    'bakiga',    5, 3),
  ('Bafumbira', 'bafumbira', 5, 4),
  ('Banyoro',   'banyoro',   5, 5),
  ('Others',    'western-others', 5, 99);

-- International (region_id = 6)
INSERT INTO tribes (name, slug, region_id, sort_order) VALUES
  ('East African', 'east-african', 6, 1),
  ('African',      'african',      6, 2),
  ('Global',       'global',       6, 3);

-- ── Genres (music styles — cross-regional) ───────────────────────
INSERT INTO genres (name, slug, color, sort_order) VALUES
  -- Traditional / Cultural
  ('Traditional',         'traditional',    '#D97706',  1),
  ('Cultural / Folk',     'cultural-folk',  '#B45309',  2),
  ('Ndere / Dance',       'ndere-dance',    '#92400E',  3),
  -- Church
  ('Gospel',              'gospel',         '#7C3AED',  4),
  ('Praise & Worship',    'praise-worship', '#8B5CF6',  5),
  ('Church Hymns',        'hymns',          '#A78BFA',  6),
  ('Contemporary Christian','ccm',          '#C4B5FD',  7),
  -- African
  ('Afrobeats',           'afrobeats',      '#EF4444',  8),
  ('Afropop',             'afropop',        '#F87171',  9),
  ('Bongo Flava',         'bongo',          '#FCA5A5', 10),
  ('Lingala',             'lingala',        '#FB923C', 11),
  ('Gengetone',           'gengetone',      '#FBBF24', 12),
  ('Benga',               'benga',          '#FCD34D', 13),
  -- International
  ('Amapiano',            'amapiano',       '#6366F1', 14),
  ('Hip-Hop / Rap',       'hiphop',         '#818CF8', 15),
  ('RnB / Soul',          'rnb',            '#A5B4FC', 16),
  ('Dancehall / Reggae',  'dancehall',      '#10B981', 17),
  ('Pop',                 'pop',            '#EC4899', 18),
  ('Jazz',                'jazz',           '#0EA5E9', 19),
  ('Electronic / EDM',    'edm',            '#8B5CF6', 20),
  -- Other
  ('Spoken Word',         'spoken-word',    '#78716C', 21),
  ('Comedy / Skit',       'comedy',         '#F59E0B', 22),
  ('Other',               'other',          '#9CA3AF', 23);

-- ── Admin user ───────────────────────────────────────────────────
-- Password: Admin@Etokwa2024
INSERT INTO users (uuid, name, email, password, role, is_active, is_verified) VALUES (
  'admin-etokwa-uuid-001',
  'Etokwa Admin',
  'admin@etokwamusic.ug',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin', 1, 1
);

-- ── System playlists ──────────────────────────────────────────────
INSERT INTO playlists (uuid, title, description, is_system, is_public, total_songs) VALUES
  ('sys-trending-001',   'Trending',      'Top trending songs right now',        1, 1, 0),
  ('sys-newrelease-001', 'New Releases',  'Fresh music just dropped',            1, 1, 0),
  ('sys-gospel-001',     'Gospel Mix',    'Inspirational gospel collection',     1, 1, 0),
  ('sys-top100-001',     'Top 100',       'The most streamed songs',             1, 1, 0),
  ('sys-traditional-001','Traditional',   'Uganda cultural & traditional songs', 1, 1, 0);

-- ================================================================
-- Done!
-- Admin: admin@etokwamusic.ug / Admin@Etokwa2024
-- ================================================================
