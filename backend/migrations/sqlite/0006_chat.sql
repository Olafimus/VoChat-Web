-- Chats zwischen Nutzern: Direkt (zwei Freunde) oder Gruppe. Nachrichten mit Text, Bild oder
-- Sprachnachricht, Antworten, Reaktionen, Korrekturvorschlag des Gegenübers und Lesestand.
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT,
  dm_key TEXT UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  last_message_at BIGINT NOT NULL
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at BIGINT NOT NULL,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user ON conversation_members (user_id);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reply_to INTEGER,
  media_key TEXT,
  media_type TEXT,
  media_meta TEXT,
  correction TEXT,
  corrected_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  edited_at BIGINT,
  deleted INTEGER NOT NULL DEFAULT 0,
  client_id TEXT
);
CREATE INDEX chat_messages_conv ON chat_messages (conversation_id, id);
CREATE UNIQUE INDEX chat_messages_client ON chat_messages (author_id, client_id);
CREATE INDEX chat_messages_author_time ON chat_messages (author_id, created_at);

CREATE TABLE chat_reactions (
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);
