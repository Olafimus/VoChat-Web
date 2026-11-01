-- Eigene Aufnahmen der Nutzer: Datei im Medien-Speicher, Freigabe durch Experten der Sprache.
-- status: approved (sichtbar für alle), pending (nur Sprecher und Experten), hidden (entfernt).
ALTER TABLE lexeme_audio ADD COLUMN user_id TEXT;
ALTER TABLE lexeme_audio ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE lexeme_audio ADD COLUMN media_key TEXT;
ALTER TABLE lexeme_audio ADD COLUMN duration_ms INTEGER;
CREATE INDEX lexeme_audio_user ON lexeme_audio (user_id, created_at);
CREATE INDEX lexeme_audio_status ON lexeme_audio (status, lexeme_id);
