-- ============================================================
--  Salvation Ministries – Super Admin Schema
--  Run this AFTER db.sql (registrations table must exist)
-- ============================================================

USE salvation_ministry;

-- ------------------------------------------------------------
--  Dynamic Service Units  (replaces hardcoded data.js)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_units (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150)    NOT NULL,
  description TEXT            DEFAULT NULL,
  coordinator VARCHAR(150)    DEFAULT NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sub_units (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  unit_id     INT UNSIGNED    NOT NULL,
  name        VARCHAR(150)    NOT NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (unit_id) REFERENCES service_units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed from the hardcoded form list
INSERT INTO service_units (id, name, sort_order) VALUES
  (1,  'Choir',                        1),
  (2,  'Special Care Unit',            2),
  (3,  'Medical Team',                 3),
  (4,  'Peacekeepers Unit',            4),
  (5,  'Safety Unit',                  5),
  (6,  'Sanctuary Keepers',            6),
  (7,  'Children Ministry',            7),
  (8,  'Decoration Unit',              8),
  (9,  'Editorial Unit',               9),
  (10, 'Crowd Management Unit (CC1)', 10),
  (11, 'Soul Establishment Unit',     11),
  (12, 'Media & Service',             12),
  (13, 'Ushering Unit',               13),
  (14, 'Foreign Language Unit',       14),
  (15, 'Horticulture',                15)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO sub_units (unit_id, name, sort_order) VALUES
  (7,  'Lessons & teaching',                      1),
  (7,  'Activities & programs',                   2),
  (7,  'Children\'s worship',                     3),
  (7,  'Environment / classroom setup',           4),
  (8,  'Sanctuary décor & altar aesthetics',      1),
  (8,  'Altar cleanliness & hygiene',             2),
  (9,  'Testimonies & life stories',              1),
  (9,  'Magazines & editorial publications',      2),
  (10, 'Entry / exit & flow',                     1),
  (10, 'Seating coordination',                    2),
  (10, 'Crowd control & queue management',        3),
  (11, 'Service unit placement & follow-up',      1),
  (11, 'Cell fellowship integration',             2),
  (12, 'Audio',                                   1),
  (12, 'Video',                                   2),
  (12, 'Electrical',                              3),
  (13, 'Seating & order',                         1),
  (13, 'Offerings & collection support',          2),
  (13, 'Visitors & new converts hospitality',     3),
  (14, 'Live interpretation (services)',          1),
  (14, 'Written materials translation',           2),
  (15, 'Cultivation & grounds care',              1),
  (15, 'Landscape design',                        2),
  (15, 'Garden / grounds maintenance',            3);

-- ------------------------------------------------------------
--  Admin Users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(150)    NOT NULL,
  username      VARCHAR(50)     NOT NULL,
  email         VARCHAR(150)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('super_admin','unit_admin','viewer') NOT NULL DEFAULT 'viewer',
  unit_access   JSON            DEFAULT NULL COMMENT 'Array of unit_ids; NULL = all',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  last_login    DATETIME        DEFAULT NULL,
  created_by    INT UNSIGNED    DEFAULT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default super admin: username=superadmin  password=Admin@1234
-- Change this password immediately after first login!
INSERT INTO admin_users (full_name, username, email, password_hash, role)
VALUES (
  'Super Administrator',
  'superadmin',
  'admin@salvationministries.org',
  '$2y$12$KBKV7HJoqLq9n.PpnZ5qLuygScmNb4wqXIwvEwY3WPvQv1iUvpSXy', -- Admin@1234
  'super_admin'
) ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- ------------------------------------------------------------
--  Auth Tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_tokens (
  token       VARCHAR(128)    NOT NULL,
  admin_id    INT UNSIGNED    NOT NULL,
  expires_at  DATETIME        NOT NULL,
  ip_address  VARCHAR(45)     DEFAULT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  INDEX idx_admin (admin_id),
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Activity Log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id     INT UNSIGNED    DEFAULT NULL,
  admin_name   VARCHAR(150)    DEFAULT NULL,
  admin_role   VARCHAR(30)     DEFAULT NULL,
  action       VARCHAR(100)    NOT NULL,
  entity_type  VARCHAR(50)     DEFAULT NULL COMMENT 'e.g. registration, unit, admin',
  entity_id    INT UNSIGNED    DEFAULT NULL,
  description  TEXT            DEFAULT NULL,
  meta         JSON            DEFAULT NULL,
  ip_address   VARCHAR(45)     DEFAULT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin   (admin_id),
  INDEX idx_action  (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add status column to registrations if not present
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS status ENUM('pending','approved','rejected','waitlisted') NOT NULL DEFAULT 'pending' AFTER sub_unit,
  ADD COLUMN IF NOT EXISTS reviewed_by INT UNSIGNED DEFAULT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL AFTER reviewed_by,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL AFTER reviewed_at,
  ADD INDEX IF NOT EXISTS idx_status (status);
