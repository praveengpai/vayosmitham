-- Contact details printed in the privacy notice (filled in by the administrator).
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('org_legal_name', 'Community Innovation Foundation'),
  ('org_address', ''),
  ('grievance_name', ''),
  ('grievance_phone', ''),
  ('grievance_email', ''),
  ('retention_years', '5'),
  ('grievance_days', '30');
DELETE FROM settings WHERE key = 'consent_notice_version';
