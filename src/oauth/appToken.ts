import { config } from "../config.js";
import { FortyTwoApiError } from "./fortyTwoClient.js";

const TOKEN_URL = "https://api.intra.42.fr/oauth/token";

let cached: { token: string; expiresAt: number } | null = null;

/** Token de aplicação (client_credentials), usado pra consultas server-to-server (sem usuário logado). */
export async function getAppAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.FT_CLIENT_ID,
      client_secret: config.FT_CLIENT_SECRET,
      scope: "public projects",
    }),
  });

  if (!response.ok) {
    throw new FortyTwoApiError(`Falha ao obter token de aplicação: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}
