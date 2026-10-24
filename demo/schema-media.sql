CREATE TABLE IF NOT EXISTS media ( key TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
