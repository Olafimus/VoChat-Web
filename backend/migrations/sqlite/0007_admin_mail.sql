-- Kontoverwaltung durch Admins (Sperren) und Passwort-Zurücksetzen per E-Mail.
ALTER TABLE users ADD COLUMN disabled_at BIGINT;

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT
);
CREATE INDEX password_resets_user ON password_resets (user_id);
