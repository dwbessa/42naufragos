import { config } from "../config.js";

const AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize";
const TOKEN_URL = "https://api.intra.42.fr/oauth/token";
const ME_URL = "https://api.intra.42.fr/v2/me";

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.FT_CLIENT_ID);
  url.searchParams.set("redirect_uri", config.OAUTH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "public");
  url.searchParams.set("state", state);
  return url.toString();
}

export class FortyTwoApiError extends Error {}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.FT_CLIENT_ID,
      client_secret: config.FT_CLIENT_SECRET,
      code,
      redirect_uri: config.OAUTH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new FortyTwoApiError(`Falha ao trocar code por token: ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new FortyTwoApiError("Resposta de token sem access_token");
  }
  return data.access_token;
}

export interface FortyTwoMe {
  id: number;
  login: string;
  "alumni?": boolean;
  campus: Array<{ id: number; name: string }>;
  cursus_users: Array<{
    grade: string | null;
    cursus: { id: number; slug: string; name: string };
  }>;
}

export async function fetchMe(accessToken: string): Promise<FortyTwoMe> {
  const response = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new FortyTwoApiError(`Falha ao buscar /v2/me: ${response.status}`);
  }

  return (await response.json()) as FortyTwoMe;
}

export function belongsToConfiguredCampus(me: FortyTwoMe): boolean {
  return me.campus.some((c) => c.id === config.FT_CAMPUS_ID);
}

/** "Transcendeu": grade "Transcender" no cursus principal (slug 42cursus / common core). */
export function hasCompletedCommonCore(me: FortyTwoMe): boolean {
  return me.cursus_users.some(
    (cu) => cu.cursus.slug === config.FT_MAIN_CURSUS_SLUG && cu.grade === "Transcender"
  );
}
