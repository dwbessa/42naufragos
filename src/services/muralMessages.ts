import type { ScaleTeamSlot } from "../oauth/evaluationsClient.js";

export function formatBrasiliaTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Escalas do time em ordem cronológica (por begin_at, desempate por id). */
export function sortSlots(slots: ScaleTeamSlot[]): ScaleTeamSlot[] {
  return [...slots].sort((a, b) => {
    const diff = new Date(a.begin_at).getTime() - new Date(b.begin_at).getTime();
    return diff !== 0 ? diff : a.id - b.id;
  });
}

/** "2/3" quando dá pra saber o total e o índice cabe nele; senão "2". */
export function ordinalLabel(index1: number, total: number | null): string {
  if (total && index1 >= 1 && index1 <= total) return `${index1}/${total}`;
  return `${index1}`;
}

/** "avaliações abertas! (precisa de 3 correções)" — projeto recém-fechado, 0 avaliações marcadas ainda. */
export function closedProjectMessage(params: {
  login: string;
  project: string;
  total: number | null;
}): string {
  const { login, project, total } = params;
  const need = total ? ` (precisa de ${total} ${total === 1 ? "correção" : "correções"})` : "";
  return `🚪 **${login}** fechou **${project}** — avaliações abertas!${need}`;
}

/**
 * Anúncio único da primeira varredura: lista os projetos já abertos aguardando
 * correção. Quebra em várias mensagens se passar do limite do Discord.
 */
export function backlogMessages(
  entries: { login: string; project: string; total: number | null }[]
): string[] {
  if (entries.length === 0) return [];

  const header = "📋 **Projetos abertos aguardando correção** — dá pra marcar avaliação:";
  const lines = entries.map(({ login, project, total }) => {
    const need = total ? ` (precisa de ${total} ${total === 1 ? "correção" : "correções"})` : "";
    return `• **${login}** — **${project}**${need}`;
  });

  const chunks: string[] = [];
  let current = header;
  for (const line of lines) {
    if (current.length + 1 + line.length > 1900) {
      chunks.push(current);
      current = line;
    } else {
      current += "\n" + line;
    }
  }
  chunks.push(current);
  return chunks;
}

/** "tem avaliação 2/3 de X marcada pra 07/09 14:00" */
export function upcomingEvaluationMessage(params: {
  login: string;
  project: string;
  ordinal: string;
  beginAt: string;
}): string {
  const { login, project, ordinal, beginAt } = params;
  return `📋 **${login}** tem avaliação **${ordinal}** de **${project}** marcada pra **${formatBrasiliaTime(beginAt)}**`;
}
