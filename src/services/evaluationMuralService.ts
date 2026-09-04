import { client } from "../discord/client.js";
import { config } from "../config.js";
import { getAllVerifiedLogins, isEvaluationPosted, markEvaluationPosted } from "../db/database.js";
import { getWaitingForCorrection, getTeamScaleTeams, sleep } from "../oauth/evaluationsClient.js";

const REQUEST_GAP_MS = 600; // respeita o rate limit de ~2 req/s da API da 42

function formatBrasiliaTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function pollUpcomingEvaluations(): Promise<void> {
  if (!config.DISCORD_MURAL_CHANNEL_ID) return;

  const logins = getAllVerifiedLogins();
  const now = Date.now();
  const windowEnd = now + config.MURAL_WINDOW_HOURS * 60 * 60 * 1000;

  const newEntries: { login: string; project: string; beginAt: string }[] = [];

  for (const login of logins) {
    try {
      const waiting = await getWaitingForCorrection(login);
      await sleep(REQUEST_GAP_MS);

      for (const pu of waiting) {
        const scaleTeams = await getTeamScaleTeams(pu.current_team_id);
        await sleep(REQUEST_GAP_MS);

        for (const st of scaleTeams) {
          if (st.filled_at) continue;
          const beginAtMs = new Date(st.begin_at).getTime();
          if (beginAtMs < now || beginAtMs > windowEnd) continue;
          if (isEvaluationPosted(st.id)) continue;

          newEntries.push({ login, project: pu.project.name, beginAt: st.begin_at });
          markEvaluationPosted(st.id);
        }
      }
    } catch (error) {
      console.error(`Erro ao checar avaliações de ${login}:`, error);
    }
  }

  if (newEntries.length === 0) return;

  const channel = await client.channels.fetch(config.DISCORD_MURAL_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) return;

  newEntries.sort((a, b) => new Date(a.beginAt).getTime() - new Date(b.beginAt).getTime());

  for (const entry of newEntries) {
    await channel.send(
      `📋 **${entry.login}** tem avaliação de **${entry.project}** marcada pra **${formatBrasiliaTime(entry.beginAt)}**`
    );
  }
}
