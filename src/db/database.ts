import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });

export const db = new DatabaseSync(config.DATABASE_PATH);
db.exec("PRAGMA journal_mode = WAL;");

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
db.exec(readFileSync(schemaPath, "utf8"));

// Migrações leves: adiciona colunas novas em tabelas que já existem no volume.
function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("posted_evaluations", "message_id", "TEXT");
ensureColumn("posted_evaluations", "begin_at", "TEXT");
ensureColumn("mural_closed_projects", "message_id", "TEXT");

export interface VerificationRecord {
  discord_id: string;
  intra_id: number;
  intra_login: string;
  is_transcender: boolean;
  verified_at: string;
}

const upsertStmt = db.prepare(`
  INSERT INTO verifications (discord_id, intra_id, intra_login, is_transcender, verified_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(discord_id) DO UPDATE SET
    intra_id = excluded.intra_id,
    intra_login = excluded.intra_login,
    is_transcender = excluded.is_transcender,
    verified_at = excluded.verified_at
`);

const getByDiscordIdStmt = db.prepare("SELECT * FROM verifications WHERE discord_id = ?");
const getByIntraIdStmt = db.prepare("SELECT * FROM verifications WHERE intra_id = ?");

function toRecord(row: unknown): VerificationRecord | undefined {
  if (!row) return undefined;
  const r = row as Record<string, unknown>;
  return {
    discord_id: r.discord_id as string,
    intra_id: r.intra_id as number,
    intra_login: r.intra_login as string,
    is_transcender: Boolean(r.is_transcender),
    verified_at: r.verified_at as string,
  };
}

export function upsertVerification(record: VerificationRecord): void {
  upsertStmt.run(
    record.discord_id,
    record.intra_id,
    record.intra_login,
    record.is_transcender ? 1 : 0,
    record.verified_at
  );
}

export function getVerificationByDiscordId(discordId: string): VerificationRecord | undefined {
  return toRecord(getByDiscordIdStmt.get(discordId));
}

export function getVerificationByIntraId(intraId: number): VerificationRecord | undefined {
  return toRecord(getByIntraIdStmt.get(intraId));
}

const getAllLoginsStmt = db.prepare("SELECT intra_login FROM verifications");

export function getAllVerifiedLogins(): string[] {
  return (getAllLoginsStmt.all() as { intra_login: string }[]).map((r) => r.intra_login);
}

const isPostedStmt = db.prepare("SELECT 1 FROM posted_evaluations WHERE scale_team_id = ?");
const markPostedStmt = db.prepare(
  "INSERT OR IGNORE INTO posted_evaluations (scale_team_id, message_id, begin_at, posted_at) VALUES (?, ?, ?, ?)"
);
const expiredEvalsStmt = db.prepare(
  "SELECT scale_team_id AS scaleTeamId, message_id AS messageId FROM posted_evaluations WHERE begin_at IS NOT NULL AND begin_at < ?"
);
const deleteEvalStmt = db.prepare("DELETE FROM posted_evaluations WHERE scale_team_id = ?");
const pruneOldNullEvalsStmt = db.prepare(
  "DELETE FROM posted_evaluations WHERE begin_at IS NULL AND posted_at < ?"
);

export function isEvaluationPosted(scaleTeamId: number): boolean {
  return isPostedStmt.get(scaleTeamId) !== undefined;
}

export function markEvaluationPosted(
  scaleTeamId: number,
  messageId: string,
  beginAt: string
): void {
  markPostedStmt.run(scaleTeamId, messageId, beginAt, new Date().toISOString());
}

/** Avaliações cujo begin_at já passou do limite — mensagem deve ser apagada. */
export function getExpiredEvaluations(cutoffIso: string): { scaleTeamId: number; messageId: string | null }[] {
  return expiredEvalsStmt.all(cutoffIso) as { scaleTeamId: number; messageId: string | null }[];
}

export function deleteEvaluationRow(scaleTeamId: number): void {
  deleteEvalStmt.run(scaleTeamId);
}

/** Limpa linhas antigas sem begin_at (legado, sem message_id pra apagar). */
export function pruneLegacyEvaluations(cutoffIso: string): void {
  pruneOldNullEvalsStmt.run(cutoffIso);
}

const isClosedNotifiedStmt = db.prepare("SELECT 1 FROM mural_closed_projects WHERE team_id = ?");
const markClosedNotifiedStmt = db.prepare(
  "INSERT OR IGNORE INTO mural_closed_projects (team_id, login, project, message_id, notified_at) VALUES (?, ?, ?, ?, ?)"
);
const staleClosedStmt = db.prepare(
  "SELECT team_id AS teamId, message_id AS messageId FROM mural_closed_projects WHERE team_id NOT IN (SELECT value FROM json_each(?))"
);
const deleteClosedRowStmt = db.prepare("DELETE FROM mural_closed_projects WHERE team_id = ?");

export function isClosedProjectNotified(teamId: number): boolean {
  return isClosedNotifiedStmt.get(teamId) !== undefined;
}

export function markClosedProjectNotified(
  teamId: number,
  login: string,
  project: string,
  messageId: string
): void {
  markClosedNotifiedStmt.run(teamId, login, project, messageId, new Date().toISOString());
}

/** Times anunciados que não estão mais aguardando correção no campus. */
export function getStaleClosedProjects(
  activeTeamIds: number[]
): { teamId: number; messageId: string | null }[] {
  return staleClosedStmt.all(JSON.stringify(activeTeamIds)) as {
    teamId: number;
    messageId: string | null;
  }[];
}

export function deleteClosedProjectRow(teamId: number): void {
  deleteClosedRowStmt.run(teamId);
}
