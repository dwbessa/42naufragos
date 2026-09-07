import { client } from "../discord/client.js";
import { config } from "../config.js";
import {
  getAllVerifiedLogins,
  isEvaluationPosted,
  markEvaluationPosted,
  getExpiredEvaluations,
  deleteEvaluationRow,
  pruneLegacyEvaluations,
  isClosedProjectNotified,
  markClosedProjectNotified,
  getStaleClosedProjects,
  deleteClosedProjectRow,
} from "../db/database.js";
import {
  getWaitingForCorrection,
  getCampusWaitingForCorrection,
  getTeamDetail,
  getProjectCorrectionNumber,
  sleep,
} from "../oauth/evaluationsClient.js";
import {
  sortSlots,
  ordinalLabel,
  closedProjectMessage,
  upcomingEvaluationMessage,
} from "./muralMessages.js";

const REQUEST_GAP_MS = 600; // respeita o rate limit de ~2 req/s da API da 42
const EVAL_MESSAGE_TTL_MS = 60 * 60 * 1000; // apaga o aviso 1h depois do begin_at
const DAY_MS = 24 * 60 * 60 * 1000;

type OutgoingMessage = { sortKey: number; text: string; onSent: (messageId: string) => void };

export async function pollUpcomingEvaluations(): Promise<void> {
  if (!config.DISCORD_MURAL_CHANNEL_ID) return;

  const toSend: OutgoingMessage[] = [];
  const toDelete = new Set<string>();

  await collectClosedProjects(toSend, toDelete);
  await collectUpcomingEvaluations(toSend);
  collectExpiredEvaluations(toDelete);

  if (toSend.length === 0 && toDelete.size === 0) return;

  const channel = await client.channels
    .fetch(config.DISCORD_MURAL_CHANNEL_ID)
    .catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;

  for (const messageId of toDelete) {
    await channel.messages.delete(messageId).catch(() => {
      /* mensagem já apagada / sem permissão — segue */
    });
  }

  toSend.sort((a, b) => a.sortKey - b.sortKey);
  for (const message of toSend) {
    const sent = await channel.send(message.text);
    message.onSent(sent.id);
  }
}

/**
 * Projetos recém-fechados de qualquer estudante do campus -> avaliações abertas.
 * Também apaga o anúncio quando o time sai de waiting_for_correction (correções
 * feitas ou projeto abandonado).
 */
async function collectClosedProjects(
  toSend: OutgoingMessage[],
  toDelete: Set<string>
): Promise<void> {
  let entries;
  try {
    entries = await getCampusWaitingForCorrection(config.FT_CAMPUS_ID);
  } catch (error) {
    console.error("Erro ao buscar projetos fechados do campus:", error);
    return;
  }

  const now = Date.now();
  const freshCutoff = now - config.MURAL_CLOSED_MAX_AGE_DAYS * DAY_MS;
  const activeTeamIds = entries.map((e) => e.teamId);

  // Apaga anúncios de times que não estão mais aguardando correção.
  for (const stale of getStaleClosedProjects(activeTeamIds)) {
    if (stale.messageId) toDelete.add(stale.messageId);
    deleteClosedProjectRow(stale.teamId);
  }

  // Anuncia os que fecharam dentro da janela de recência e ainda não foram anunciados.
  for (const entry of entries) {
    if (!entry.markedAt || Date.parse(entry.markedAt) < freshCutoff) continue;
    if (isClosedProjectNotified(entry.teamId)) continue;

    toSend.push({
      sortKey: now,
      text: closedProjectMessage({ login: entry.login, project: entry.projectName, total: null }),
      onSent: (messageId) =>
        markClosedProjectNotified(entry.teamId, entry.login, entry.projectName, messageId),
    });
  }
}

/** Lembretes de avaliação agendada dentro da janela — só pra quem se verificou no Discord. */
async function collectUpcomingEvaluations(toSend: OutgoingMessage[]): Promise<void> {
  const logins = getAllVerifiedLogins();
  const now = Date.now();
  const windowEnd = now + config.MURAL_WINDOW_HOURS * 60 * 60 * 1000;

  for (const login of logins) {
    try {
      const waiting = await getWaitingForCorrection(login);
      await sleep(REQUEST_GAP_MS);

      for (const pu of waiting) {
        const team = await getTeamDetail(pu.current_team_id);
        await sleep(REQUEST_GAP_MS);

        const total = getProjectCorrectionNumber(team.scale_teams);
        const slots = sortSlots(team.scale_teams);

        slots.forEach((slot, i) => {
          if (slot.filled_at) return;
          const beginAtMs = new Date(slot.begin_at).getTime();
          if (beginAtMs < now || beginAtMs > windowEnd) return;
          if (isEvaluationPosted(slot.id)) return;

          toSend.push({
            sortKey: beginAtMs,
            text: upcomingEvaluationMessage({
              login,
              project: pu.project.name,
              ordinal: total ? ordinalLabel(i + 1, total) : null,
              beginAt: slot.begin_at,
            }),
            onSent: (messageId) => markEvaluationPosted(slot.id, messageId, slot.begin_at),
          });
        });
      }
    } catch (error) {
      console.error(`Erro ao checar avaliações de ${login}:`, error);
    }
  }
}

/** Avaliações cujo horário já passou de 1h -> apaga o aviso. */
function collectExpiredEvaluations(toDelete: Set<string>): void {
  const cutoff = new Date(Date.now() - EVAL_MESSAGE_TTL_MS).toISOString();
  for (const expired of getExpiredEvaluations(cutoff)) {
    if (expired.messageId) toDelete.add(expired.messageId);
    deleteEvaluationRow(expired.scaleTeamId);
  }
  // Linhas legado (sem begin_at, sem message_id) some depois de 2 dias.
  pruneLegacyEvaluations(new Date(Date.now() - 2 * DAY_MS).toISOString());
}
