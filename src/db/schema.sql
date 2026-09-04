CREATE TABLE IF NOT EXISTS verifications (
  discord_id TEXT PRIMARY KEY,
  intra_id INTEGER NOT NULL UNIQUE,
  intra_login TEXT NOT NULL,
  is_transcender INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT NOT NULL
);
