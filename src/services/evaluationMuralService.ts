import { client } from "../discord/client.js";
import { config } from "../config.js";
import {
  getAllVerifiedLogins,
  isEvaluationPosted,
  markEvaluationPosted,
  isClosedProjectNotified,
  markClosedProjectNotified,
  pruneClosedProjects,
  isCampusBacklogDone,
  markCampusBacklogDone,
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
  backlogMessages,
} from "./muralMessages.js";

const REQUEST_GAP_MS = 600; // respeita o rate limit de ~2 req/s da API da 42

type OutgoingMessage = { sortKey: number; text: string };

export async function pollUpcomingEvaluations(): Promise<void> {
  if (!config.DISCORD_MURAL_CHANNEL_ID) return;

  const messages: OutgoingMessage[] = [];

  await collectClosedProjects(messages); // campus inteiro (42 Rio)
  await collectUpcomingEvaluations(messages); // só verificados no Discord

  if (messages.length === 0) return;

  const channel = await client.channels.fetch(config.DISCORD_MURAL_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;

  messages.sort((a, b) => a.sortKey - b.sortKey);
  for (const message of messages) {
    await channel.send(message.text);
  }
}

/**
 * Anuncia projetos recém-fechados de qualquer estudante do campus. Na primeira
 * varredura despeja o backlog inteiro (projetos já abertos); depois, só os novos.
 */
async function collectClosedProjects(messages: OutgoingMessage[]): Promise<void> {
  let entries;
  try {
    entries = await getCampusWaitingForCorrection(config.FT_CAMPUS_ID);
  } catch (error) {
    console.error("Erro ao buscar projetos fechados do campus:", error);
    return;
  }

  const now = Date.now();
  const bootstrapping = !isCampusBacklogDone();
  const backlog: { login: string; project: string; total: number | null }[] = [];

  for (const entry of entries) {
    if (isClosedProjectNotified(entry.teamId)) continue;

    const total = await getProjectCorrectionNumber(entry.projectId, []);
    await sleep(REQUEST_GAP_MS);

    if (bootstrapping) {
      backlog.push({ login: entry.login, project: entry.projectName, total });
    } else {
      messages.push({
        sortKey: now,
        text: closedProjectMessage({ login: entry.login, project: entry.projectName, total }),
      });
    }
    markClosedProjectNotified(entry.teamId, entry.login, entry.projectName);
  }

  pruneClosedProjects(entries.map((e) => e.teamId));

  if (bootstrapping) {
    for (const text of backlogMessages(backlog)) {
      messages.push({ sortKey: -1, text });
    }
    markCampusBacklogDone();
  }
}

/** Lembretes de avaliação agendada dentro da janela — só pra quem se verificou no Discord. */
async function collectUpcomingEvaluations(messages: OutgoingMessage[]): Promise<void> {
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

        const total = await getProjectCorrectionNumber(pu.project.id, team.scale_teams);
        const slots = sortSlots(team.scale_teams);

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
    } catch (error) {
      console.error(`Erro ao checar avaliações de ${login}:`, error);
    }
  }
}
