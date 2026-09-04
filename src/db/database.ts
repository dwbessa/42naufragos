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
