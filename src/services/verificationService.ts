import { client } from "../discord/client.js";
import { config } from "../config.js";
import {
  belongsToConfiguredCampus,
  exchangeCodeForToken,
  fetchMe,
  FortyTwoApiError,
  hasCompletedCommonCore,
  isStaff,
} from "../oauth/fortyTwoClient.js";
import { consumeState } from "../oauth/stateStore.js";
import { getVerificationByIntraId, upsertVerification } from "../db/database.js";

export class VerificationError extends Error {}

export async function completeVerification(code: string, state: string): Promise<{ login: string }> {
  const discordId = consumeState(state);
  if (!discordId) {
    throw new VerificationError("Link expirado ou já utilizado. Rode /verify de novo no Discord.");
  }

  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(code);
  } catch (error) {
    if (error instanceof FortyTwoApiError) throw new VerificationError(error.message);
    throw error;
  }

  const me = await fetchMe(accessToken);

  if (!belongsToConfiguredCampus(me)) {
    throw new VerificationError("Sua conta da intra não pertence ao campus 42 Rio.");
  }

  if (isStaff(me)) {
    throw new VerificationError("Contas de staff da 42 não podem se verificar neste servidor.");
  }

  const conflicting = getVerificationByIntraId(me.id);
  if (conflicting && conflicting.discord_id !== discordId) {
    throw new VerificationError(
      "Essa conta da intra já está vinculada a outro usuário do Discord. Fala com a staff se isso for um engano."
    );
  }

  const isTranscender = hasCompletedCommonCore(me);

  upsertVerification({
    discord_id: discordId,
    intra_id: me.id,
    intra_login: me.login,
    is_transcender: isTranscender,
    verified_at: new Date().toISOString(),
  });

  const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
  const member = await guild.members.fetch(discordId).catch(() => null);

  if (member) {
    const rolesToAdd = [config.DISCORD_VERIFIED_ROLE_ID];

    if (config.DISCORD_TRANSCENDER_ROLE_ID && isTranscender) {
      rolesToAdd.push(config.DISCORD_TRANSCENDER_ROLE_ID);
    }

    await member.roles.add(rolesToAdd).catch((error) => {
      console.error("Falha ao atribuir role:", error);
    });
    await member.setNickname(me.login).catch(() => null);
    await member.send(`Verificação concluída! Você foi vinculado como \`${me.login}\` e já tem acesso ao servidor.`).catch(() => null);
  }

  return { login: me.login };
}
