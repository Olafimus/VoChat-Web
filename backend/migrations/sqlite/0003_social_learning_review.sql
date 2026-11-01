-- Verweise in Sync-Zeilen für serverseitige Auswertungen (Challenges):
-- Karten: ref_key = "<sprache>:<wortschlüssel>", ref_id = Lexem-ID. Lernereignisse: attr = Ergebnis.
ALTER TABLE sync_rows ADD COLUMN ref_key TEXT;
ALTER TABLE sync_rows ADD COLUMN ref_id INTEGER;
CREATE INDEX sync_rows_ref ON sync_rows (user_id, entity, ref_key);
CREATE INDEX sync_rows_time ON sync_rows (user_id, entity, updated_at);

-- Gemeinsames Lernen: Duelle/Gruppen (mit Freunden) und Wochen-Challenges (offen für alle).
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  lang TEXT NOT NULL,
  creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  items TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  week_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX challenges_kind ON challenges (kind, lang, ends_at);

CREATE TABLE challenge_members (
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  invited_by TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX challenge_members_user ON challenge_members (user_id, status);

-- Expertenprüfung: ohne Eintrag gilt ein Lexem als ungeprüft (auch importierte Standarddaten).
CREATE TABLE entry_reviews (
  lexeme_id INTEGER PRIMARY KEY REFERENCES lexemes(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at INTEGER NOT NULL,
  note TEXT
);

-- Änderungsprotokoll: wer hat wann was geändert oder geprüft.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  lang TEXT,
  lexeme_id INTEGER,
  item_type TEXT,
  item_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_log_lexeme ON audit_log (lexeme_id, created_at);
CREATE INDEX audit_log_actor ON audit_log (actor_id, created_at);

-- Verdachtsfälle: nach einer Korrektur werden ähnliche Einträge zur Prüfung vorgezogen.
CREATE TABLE suspicions (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  score INTEGER NOT NULL,
  trigger_audit_id INTEGER REFERENCES audit_log(id) ON DELETE CASCADE,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (lexeme_id, reason, trigger_audit_id)
);
CREATE INDEX suspicions_open ON suspicions (resolved, lexeme_id);

-- Kommentare (Baum über parent_id) zu Beiträgen, Einträgen, Sammlungen und Challenges; mit Bewertungen.
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX comments_target ON comments (target_type, target_id, id);

CREATE TABLE comment_votes (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
