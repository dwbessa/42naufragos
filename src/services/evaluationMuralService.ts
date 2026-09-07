import { client } from "../discord/client.js";
import { config } from "../config.js";
import {
  getAllVerifiedLogins,
  isEvaluationPosted,
  markEvaluationPosted,
  hasSeenMuralLogin,
  markMuralLoginSeen,
  isClosedProjectNotified,
  markClosedProjectNotified,
  pruneClosedProjects,
} from "../db/database.js";
import {
  getWaitingForCorrection,
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

type OutgoingMessage = { sortKey: number; text: string };

export async function pollUpcomingEvaluations(): Promise<void> {
  if (!config.DISCORD_MURAL_CHANNEL_ID) return;

  const logins = getAllVerifiedLogins();
  const now = Date.now();
  const windowEnd = now + config.MURAL_WINDOW_HOURS * 60 * 60 * 1000;

  const messages: OutgoingMessage[] = [];

  for (const login of logins) {
    try {
      const waiting = await getWaitingForCorrection(login);
      await sleep(REQUEST_GAP_MS);

      const seenLogin = hasSeenMuralLogin(login);
      const activeTeamIds: number[] = [];

      for (const pu of waiting) {
        activeTeamIds.push(pu.current_team_id);

        const alreadyAnnounced = isClosedProjectNotified(pu.current_team_id);
        const team = await getTeamDetail(pu.current_team_id);
        await sleep(REQUEST_GAP_MS);

        const total = await getProjectCorrectionNumber(pu.project.id, team.scale_teams);
        const slots = sortSlots(team.scale_teams);

        // 1) Projeto recém-fechado -> avaliações abertas
        if (!alreadyAnnounced) {
          if (seenLogin) {
            messages.push({
              sortKey: now,
              text: closedProjectMessage({
                login,
                project: pu.project.name,
                booked: slots.length,
                total,
              }),
            });
          }
          markClosedProjectNotified(pu.current_team_id, login, pu.project.name);
        }

        // 2) Avaliações agendadas dentro da janela
        slots.forEach((slot, i) => {
          if (slot.filled_at) return;
          const beginAtMs = new Date(slot.begin_at).getTime();
          if (beginAtMs < now || beginAtMs > windowEnd) return;
          if (isEvaluationPosted(slot.id)) return;

          messages.push({
            sortKey: beginAtMs,
            text: upcomingEvaluationMessage({
              login,
              project: pu.project.name,
              ordinal: ordinalLabel(i + 1, total),
              beginAt: slot.begin_at,
            }),
          });
          markEvaluationPosted(slot.id);
        });
      }

      pruneClosedProjects(login, activeTeamIds);
      if (!seenLogin) markMuralLoginSeen(login);
    } catch (error) {
      console.error(`Erro ao checar avaliações de ${login}:`, error);
    }
  }

  if (messages.length === 0) return;

  const channel = await client.channels.fetch(config.DISCORD_MURAL_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;

  messages.sort((a, b) => a.sortKey - b.sortKey);
  for (const message of messages) {
    await channel.send(message.text);
  }
}
