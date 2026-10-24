-- Two new roles: CIF super admin (superadmin) and AGeD clinical admin (clinical_admin).
-- SQLite cannot change a CHECK constraint in place, so the users table is rebuilt.
-- Order matters: copy the rows aside, drop and recreate "users", then copy the rows back. Re-inserting the rows
-- into a table named "users" satisfies the deferred foreign keys from sessions/persons/consents before commit.
PRAGMA defer_foreign_keys = true;

CREATE TABLE users_backup AS SELECT * FROM users;
DROP TABLE users;

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL CHECK (role IN ('superadmin','admin','clinical_admin','coordinator','worker','dentist','auditor','dpo','researcher')),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL UNIQUE,
  email           TEXT,
  pin_hash        TEXT NOT NULL,
  pin_salt        TEXT NOT NULL,
  must_change     INTEGER NOT NULL DEFAULT 1,
  active          INTEGER NOT NULL DEFAULT 1,
  organisation    TEXT,
  state           TEXT,
  district        TEXT,
  lsgd_type       TEXT,
  lsgd_name       TEXT,
  ward            TEXT,
  reg_council     TEXT,
  reg_number      TEXT,
  reg_verified_at TEXT,
  ui_lang         TEXT NOT NULL DEFAULT 'en',
  content_lang    TEXT NOT NULL DEFAULT 'ml',
  translate_on    INTEGER NOT NULL DEFAULT 1,
  trained_at      TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  pincode         TEXT
);

INSERT INTO users (id, role, name, phone, email, pin_hash, pin_salt, must_change, active, organisation, state, district, lsgd_type, lsgd_name, ward,
  reg_council, reg_number, reg_verified_at, ui_lang, content_lang, translate_on, trained_at, failed_attempts, locked_until, created_at, updated_at, pincode)
SELECT id, role, name, phone, email, pin_hash, pin_salt, must_change, active, organisation, state, district, lsgd_type, lsgd_name, ward,
  reg_council, reg_number, reg_verified_at, ui_lang, content_lang, translate_on, trained_at, failed_attempts, locked_until, created_at, updated_at, pincode
FROM users_backup;

DROP TABLE users_backup;

-- The programme founder's account becomes the CIF super admin.
UPDATE users SET role = 'superadmin', organisation = COALESCE(organisation, 'Community Innovation Foundation') WHERE phone = '8129060055';
