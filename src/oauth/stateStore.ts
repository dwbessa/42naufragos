import { randomBytes } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
  discordId: string;
  expiresAt: number;
}

const pending = new Map<string, PendingState>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [state, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(state);
  }
}

export function createState(discordId: string): string {
  cleanupExpired();
  const state = randomBytes(24).toString("hex");
  pending.set(state, { discordId, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

/** Consome o state (uso único). Retorna o discordId associado, ou undefined se inválido/expirado. */
export function consumeState(state: string): string | undefined {
  cleanupExpired();
  const entry = pending.get(state);
  if (!entry) return undefined;
  pending.delete(state);
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.discordId;
}
