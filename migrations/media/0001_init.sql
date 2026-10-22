-- Vayosmitham MEDIA STORE (interim)
-- Intraoral photos are kept here only until R2 object storage is enabled on the Cloudflare account.
-- The app switches to R2 automatically when the MEDIA_BUCKET binding exists.
CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  bytes      BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
