import { getAppAccessToken } from "./appToken.js";
import { FortyTwoApiError } from "./fortyTwoClient.js";

const API_BASE = "https://api.intra.42.fr/v2";

async function fetchJson<T>(path: string): Promise<T> {
  const token = await getAppAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new FortyTwoApiError(`Falha ao consultar ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

interface ProjectUserWaiting {
  id: number;
  current_team_id: number;
  project: { id: number; name: string; slug: string };
}

/** Projetos entregues aguardando correção pra um login (status "waiting_for_correction"). */
export async function getWaitingForCorrection(login: string): Promise<ProjectUserWaiting[]> {
  return fetchJson<ProjectUserWaiting[]>(
    `/users/${encodeURIComponent(login)}/projects_users?filter[status]=waiting_for_correction&per_page=20`
  );
}

export interface CampusWaitingEntry {
  teamId: number;
  login: string;
  projectId: number;
  projectName: string;
  markedAt: string | null;
}

interface CampusProjectUser {
  current_team_id: number | null;
  marked_at: string | null;
  project: { id: number; name: string };
  user?: { login: string } | null;
  login?: string;
}

/**
 * Todos os projetos do campus em waiting_for_correction. Uma consulta paginada
 * em vez de varrer usuário por usuário.
 *
 * Retorna a lista bruta (com marked_at) — o serviço decide o que é "fechou
 * agora" (recência) e o que ainda está aberto (pra saber quando apagar o
 * anúncio). A lista bruta tem zumbis de anos atrás e placeholders de avaliação
 * de estágio (marked_at null); o filtro de recência mora no serviço.
 */
export async function getCampusWaitingForCorrection(campusId: number): Promise<CampusWaitingEntry[]> {
  const out: CampusWaitingEntry[] = [];
  const pageSize = 100;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchJson<CampusProjectUser[]>(
      `/projects_users?filter[status]=waiting_for_correction&filter[campus]=${campusId}` +
        `&page[size]=${pageSize}&page[number]=${page}`
    );

    for (const pu of batch) {
      const login = pu.user?.login ?? pu.login;
      if (!login || !pu.current_team_id) continue;
      out.push({
        teamId: pu.current_team_id,
        login,
        projectId: pu.project.id,
        projectName: pu.project.name,
        markedAt: pu.marked_at,
      });
    }

    if (batch.length < pageSize) break;
    await sleep(600);
  }

  return out;
}

export interface ScaleTeamSlot {
  id: number;
  begin_at: string;
  filled_at: string | null;
  /** Presente quando a API devolve a escala aninhada; usamos o correction_number pra montar "X/N". */
  scale?: { correction_number?: number } | null;
}

export interface TeamDetail {
  id: number;
  project_id: number;
  scale_teams: ScaleTeamSlot[];
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  return fetchJson<TeamDetail>(`/teams/${teamId}`);
}

/** Compat: só as escalas de um time. */
export async function getTeamScaleTeams(teamId: number): Promise<ScaleTeamSlot[]> {
  const team = await getTeamDetail(teamId);
  return team.scale_teams;
}

/**
 * Quantas avaliações o projeto exige (o "N" de "X/N"), lido do scale aninhado
 * nas escalas do time quando a API manda. Não dá pra buscar em /projects/:id/scales
 * — 403 com o token de aplicação. Retorna null quando não vem aninhado.
 */
export function getProjectCorrectionNumber(scaleTeams: ScaleTeamSlot[]): number | null {
  const fromNested = scaleTeams
    .map((st) => st.scale?.correction_number)
    .find((n): n is number => typeof n === "number" && n > 0);
  return fromNested ?? null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
