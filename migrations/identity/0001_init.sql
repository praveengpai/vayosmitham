-- Vayosmitham IDENTITY VAULT
-- Holds everything that identifies a person or a staff member.
-- The dentist-facing API code never queries persons/consents in this database.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL CHECK (role IN ('admin','coordinator','worker','dentist','auditor','dpo','researcher')),
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
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS persons (
  id               TEXT PRIMARY KEY,           -- Person ID, e.g. VS-7K3P9Q (random, non-identifying)
  client_uuid      TEXT UNIQUE,                -- idempotency key from offline device
  name             TEXT NOT NULL,
  sex              TEXT NOT NULL CHECK (sex IN ('F','M','O')),
  birth_year       INTEGER,
  phone            TEXT,
  address          TEXT,
  state            TEXT NOT NULL,
  district         TEXT NOT NULL,
  lsgd_type        TEXT NOT NULL,
  lsgd_name        TEXT NOT NULL,
  ward             TEXT,
  location_override_reason TEXT,               -- set when location differs from the worker's default
  abha             TEXT,
  caregiver_name   TEXT,
  caregiver_phone  TEXT,
  caregiver_relation TEXT,
  worker_id        TEXT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','died','migrated','withdrawn','lost')),
  status_reason    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_persons_worker ON persons(worker_id);
CREATE INDEX IF NOT EXISTS idx_persons_dup ON persons(name, birth_year, lsgd_name);

CREATE TABLE IF NOT EXISTS consents (
  id                TEXT PRIMARY KEY,
  person_id         TEXT NOT NULL REFERENCES persons(id),
  layer             TEXT NOT NULL CHECK (layer IN ('care','photos','research','messaging','abha')),
  granted           INTEGER NOT NULL,
  method            TEXT NOT NULL CHECK (method IN ('signature','thumb','verbal_witnessed','caregiver_assent')),
  witness_name      TEXT,
  capacity          TEXT NOT NULL CHECK (capacity IN ('has_capacity','doubtful','lacks')),
  assent_by         TEXT,
  assent_relation   TEXT,
  notice_version    TEXT NOT NULL,
  notice_language   TEXT NOT NULL,
  recorded_by       TEXT NOT NULL REFERENCES users(id),
  recorded_at       TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at      TEXT,
  withdrawn_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_consents_person ON consents(person_id);
