-- Versioned questionnaire. Version 1 is the built-in questionnaire in public/shared/clinical.js;
-- every change published by the AGeD clinical admin (or restored by the CIF super admin) is a new row.
CREATE TABLE IF NOT EXISTS questionnaires (
  version         INTEGER PRIMARY KEY,
  content         TEXT NOT NULL,             -- JSON, validated by public/shared/questionnaire.js
  note            TEXT NOT NULL,             -- what changed and why
  restored_from   INTEGER,                   -- set when the super admin rolls back to an earlier version
  created_by      TEXT NOT NULL,
  created_by_name TEXT,
  created_by_role TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Each screening records the questionnaire version it was taken with, so data stays comparable over the years.
ALTER TABLE screenings ADD COLUMN questionnaire_version INTEGER NOT NULL DEFAULT 1;
-- Answers to additional questions on the teeth/dentures step (e.g. denture care).
ALTER TABLE screenings ADD COLUMN extra TEXT NOT NULL DEFAULT '{}';
