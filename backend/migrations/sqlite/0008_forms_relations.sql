-- Wortformen mit grammatischen Angaben (Konjugation, Deklination, Steigerung) für die Anzeige.
-- lexeme_forms bleibt der Suchindex (nur Wortschlüssel); hier stehen die lesbaren Formen.
CREATE TABLE lexeme_inflections (
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  form TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  PRIMARY KEY (lexeme_id, form, tags)
);
CREATE INDEX lexeme_inflections_source ON lexeme_inflections (source);

-- Wortbeziehungen (Synonyme, Gegenteile, verwandte und abgeleitete Wörter, Ober-/Unterbegriffe).
-- Das Ziel wird über Sprache + Wortschlüssel aufgelöst, damit es mit dem Wörterbuch verknüpft bleibt.
CREATE TABLE lexeme_relations (
  lexeme_id INTEGER NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  target_lemma TEXT NOT NULL,
  target_key TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (lexeme_id, kind, target_key)
);
CREATE INDEX lexeme_relations_source ON lexeme_relations (source);
