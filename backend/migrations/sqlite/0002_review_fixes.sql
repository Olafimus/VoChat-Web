-- Was ein verifizierter Beitrag tatsächlich verändert hat (für einen sauberen Widerruf).
ALTER TABLE contributions ADD COLUMN result_info TEXT;

-- Dauerhafte Einstellungen der Installation (z. B. Schlüssel für signierte Avatar-Links).
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
