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

export interface ScaleTeamSlot {
  id: number;
  begin_at: string;
  filled_at: string | null;
}

interface TeamDetail {
  id: number;
  scale_teams: ScaleTeamSlot[];
}

export async function getTeamScaleTeams(teamId: number): Promise<ScaleTeamSlot[]> {
  const team = await fetchJson<TeamDetail>(`/teams/${teamId}`);
  return team.scale_teams;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
