import { DatabaseSync } from "node:sqlite";

/**
 * Schema: Nutzer/Sessions, generischer Sync-Speicher (ein Change-Log mit
 * globaler Sequenz) und das Wörterbuch (Lexeme mit Bedeutungen, Beispielen,
 * Übersetzungen und Kategorien).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  native_lang TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_ext TEXT,
  avatar_version INTEGER NOT NULL DEFAULT 0,
  profile_public INTEGER NOT NULL DEFAULT 1,
  show_progress INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_learn_langs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  target_cefr TEXT,
  PRIMARY KEY (user_id, lang)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters (name, value) VALUES ('seq', 0);

CREATE TABLE IF NOT EXISTS sync_rows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity, id)
);
CREATE INDEX IF NOT EXISTS sync_rows_seq ON sync_rows (user_id, seq);

CREATE INDEX IF NOT EXISTS sync_rows_entity ON sync_rows (entity, deleted);

-- Bewertungen für öffentliche Lernpfade/Medien-Sammlungen (1 pro Nutzer und Sammlung).
CREATE TABLE IF NOT EXISTS ratings (
  collection_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (collection_id, user_id)
);

CREATE TABLE IF NOT EXISTS lexemes (
  id INTEGER PRIMARY KEY,
  lang TEXT NOT NULL,
  lemma TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  gender TEXT,
  cefr TEXT,
  romanization TEXT,
  frequency_rank INTEGER,
  frequency_count INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (lang, lemma, pos)
);
CREATE INDEX IF NOT EXISTS lexemes_lookup ON lexemes (lang, lemma COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS lexemes_rank ON lexemes (lang, frequency_rank);
CREATE INDEX IF NOT EXISTS lexemes_cefr ON lexemes (lang, cefr, frequency_rank);

CREATE TABLE IF NOT EXISTS senses (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  gloss_lang TEXT NOT NULL,
  gloss TEXT NOT NULL,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS senses_lexeme ON senses (lexeme_id, gloss_lang, position);

CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  translation TEXT,
  translation_lang TEXT,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS examples_lexeme ON examples (lexeme_id);

CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL,
  target_lemma TEXT NOT NULL,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (lexeme_id, target_lang, target_lemma)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  UNIQUE (name, kind)
);

CREATE TABLE IF NOT EXISTS lexeme_categories (
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (lexeme_id, category_id)
);
CREATE INDEX IF NOT EXISTS lexeme_categories_cat ON lexeme_categories (category_id);

-- Follower-Beziehungen. Bei öffentlichen Profilen sofort "accepted", sonst "requested" bis zur Zustimmung.
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee ON follows (followee_id, status);

-- Freundschaften: user_low < user_high. "pending" mit requested_by zeigt, wer gefragt hat.
CREATE TABLE IF NOT EXISTS friendships (
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_low, user_high)
);

-- Rollen: admin (global), expert (je Sprache). Beiträge und Stimmen der Community.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT '',
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role, lang)
);

CREATE TABLE IF NOT EXISTS contributions (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  lang TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT,
  decision_reason TEXT,
  result_lexeme_id INTEGER
);
CREATE INDEX IF NOT EXISTS contributions_status ON contributions (status, lang, id);
CREATE INDEX IF NOT EXISTS contributions_author ON contributions (author_id, status);

CREATE TABLE IF NOT EXISTS votes (
  contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  is_expert INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (contribution_id, user_id)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  lang TEXT,
  file TEXT NOT NULL,
  rows INTEGER NOT NULL,
  imported_at INTEGER NOT NULL
);
`;

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

/** Führt `fn` in einer Transaktion aus. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
