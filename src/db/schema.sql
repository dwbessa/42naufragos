CREATE TABLE IF NOT EXISTS verifications (
  discord_id TEXT PRIMARY KEY,
  intra_id INTEGER NOT NULL UNIQUE,
  intra_login TEXT NOT NULL,
  is_transcender INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT NOT NULL
);

-- Avaliações agendadas já postadas no mural. Guarda o message_id pra apagar
-- a mensagem 1h depois do begin_at (avaliação já passou).
CREATE TABLE IF NOT EXISTS posted_evaluations (
  scale_team_id INTEGER PRIMARY KEY,
  message_id TEXT,
  begin_at TEXT,
  posted_at TEXT NOT NULL
);

-- Times (projeto fechado por alguém) já anunciados no mural. Guarda o
-- message_id pra apagar quando o time sai de waiting_for_correction (todas as
-- correções feitas ou projeto abandonado).
CREATE TABLE IF NOT EXISTS mural_closed_projects (
  team_id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  project TEXT NOT NULL,
  message_id TEXT,
  notified_at TEXT NOT NULL
);
