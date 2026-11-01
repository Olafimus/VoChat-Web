-- VoChat Schema (SQLite). Gegenstück: migrations/postgres/0001_init.sql

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
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

CREATE TABLE user_learn_langs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  target_cefr TEXT,
  PRIMARY KEY (user_id, lang)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO counters (name, value) VALUES ('seq', 0);

-- Sync-Speicher: eine Zeile je Entität. attr: kleines, entitätsabhängiges Merkmal für Auswertungen (Karten: Status).
CREATE TABLE sync_rows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  attr TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity, id)
);
CREATE INDEX sync_rows_seq ON sync_rows (user_id, seq);
CREATE INDEX sync_rows_attr ON sync_rows (user_id, entity, attr);

-- Öffentlich geteilte Sammlungen, gepflegt beim Sync. Die Wortliste liegt als JSON-Text vor.
CREATE TABLE public_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  media_type TEXT,
  lang TEXT NOT NULL,
  level TEXT,
  title TEXT NOT NULL,
  title_key TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  items TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX public_collections_filter ON public_collections (kind, lang, updated_at);
CREATE INDEX public_collections_owner ON public_collections (user_id);

CREATE TABLE ratings (
  collection_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (collection_id, user_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id, status);

CREATE TABLE friendships (
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_low, user_high)
);
CREATE INDEX friendships_high ON friendships (user_high, status);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT '',
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role, lang)
);

CREATE TABLE lexemes (
  id INTEGER PRIMARY KEY,
  lang TEXT NOT NULL,
  lemma TEXT NOT NULL,
  lemma_key TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  gender TEXT,
  cefr TEXT,
  romanization TEXT,
  frequency_rank INTEGER,
  frequency_count INTEGER,
  hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (lang, lemma, pos)
);
CREATE INDEX lexemes_key ON lexemes (lang, lemma_key);
CREATE INDEX lexemes_rank ON lexemes (lang, frequency_rank);
CREATE INDEX lexemes_cefr ON lexemes (lang, cefr, frequency_rank);

-- Gebeugte Formen (z. B. "sieht" -> "sehen") für die Wortextraktion aus Texten.
CREATE TABLE lexeme_forms (
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  form_key TEXT NOT NULL,
  PRIMARY KEY (lexeme_id, form_key)
);
CREATE INDEX lexeme_forms_key ON lexeme_forms (lang, form_key);

CREATE TABLE senses (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  gloss_lang TEXT NOT NULL,
  gloss TEXT NOT NULL,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX senses_lexeme ON senses (lexeme_id, gloss_lang, position);
CREATE INDEX senses_source ON senses (source);

CREATE TABLE examples (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  translation TEXT,
  translation_lang TEXT,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX examples_lexeme ON examples (lexeme_id);
CREATE INDEX examples_source ON examples (source);

CREATE TABLE translations (
  id INTEGER PRIMARY KEY,
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL,
  target_lemma TEXT NOT NULL,
  source TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  UNIQUE (lexeme_id, target_lang, target_lemma)
);
CREATE INDEX translations_source ON translations (source);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  UNIQUE (name, kind)
);

CREATE TABLE lexeme_categories (
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (lexeme_id, category_id)
);
CREATE INDEX lexeme_categories_cat ON lexeme_categories (category_id);

CREATE TABLE contributions (
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
CREATE INDEX contributions_status ON contributions (status, lang, id);
CREATE INDEX contributions_author ON contributions (author_id, status);

CREATE TABLE votes (
  contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  is_expert INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (contribution_id, user_id)
);

CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  lang TEXT,
  file TEXT NOT NULL,
  rows INTEGER NOT NULL,
  imported_at INTEGER NOT NULL
);
