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

/** "avaliações abertas! (1/3 marcadas)" — progresso de agendamento do projeto recém-fechado. */
export function closedProjectMessage(params: {
  login: string;
  project: string;
  booked: number;
  total: number | null;
}): string {
  const { login, project, booked, total } = params;
  const progress = total ? `${booked}/${total} marcada${booked === 1 ? "" : "s"}` : `${booked} marcada${booked === 1 ? "" : "s"}`;
  return `🚪 **${login}** fechou **${project}** — avaliações abertas! (${progress})`;
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
