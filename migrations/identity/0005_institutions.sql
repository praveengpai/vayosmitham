-- Institutions: a dental college, hospital or clinic can take part with its own coordinator login
-- (role institution_admin), who assigns cases to the institution's dentists. users.institution_id links staff to it.
-- Same safe rebuild as 0004 (the role CHECK constraint cannot be altered in place).
PRAGMA defer_foreign_keys = true;

CREATE TABLE users_backup AS SELECT * FROM users;
DROP TABLE users;

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL CHECK (role IN ('superadmin','admin','clinical_admin','institution_admin','coordinator','worker','dentist','auditor','dpo','researcher')),
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
  pincode         TEXT,
  institution_id  TEXT                -- dental college / hospital / clinic the dentist or institution coordinator belongs to
);

INSERT INTO users (id, role, name, phone, email, pin_hash, pin_salt, must_change, active, organisation, state, district, lsgd_type, lsgd_name, ward,
  reg_council, reg_number, reg_verified_at, ui_lang, content_lang, translate_on, trained_at, failed_attempts, locked_until, created_at, updated_at, pincode)
SELECT id, role, name, phone, email, pin_hash, pin_salt, must_change, active, organisation, state, district, lsgd_type, lsgd_name, ward,
  reg_council, reg_number, reg_verified_at, ui_lang, content_lang, translate_on, trained_at, failed_attempts, locked_until, created_at, updated_at, pincode
FROM users_backup;

DROP TABLE users_backup;

CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
