CREATE TABLE IF NOT EXISTS verifications (
  discord_id TEXT PRIMARY KEY,
  intra_id INTEGER NOT NULL UNIQUE,
  intra_login TEXT NOT NULL,
  is_transcender INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posted_evaluations (
  scale_team_id INTEGER PRIMARY KEY,
  posted_at TEXT NOT NULL
);

-- Logins cujos projetos fechados já foram "semeados" numa primeira varredura,
-- pra não notificar retroativamente projetos fechados antes de a gente ver o usuário.
CREATE TABLE IF NOT EXISTS mural_seen_logins (
  login TEXT PRIMARY KEY,
  seen_at TEXT NOT NULL
);

-- Times (projeto fechado por alguém) já anunciados no mural. A linha é removida
-- quando o time some da lista de waiting_for_correction, permitindo re-anunciar
-- se a pessoa refizer e fechar o projeto de novo.
CREATE TABLE IF NOT EXISTS mural_closed_projects (
  team_id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  project TEXT NOT NULL,
  notified_at TEXT NOT NULL
);

-- Flags simples do mural (ex: primeira varredura já concluída).
CREATE TABLE IF NOT EXISTS mural_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
