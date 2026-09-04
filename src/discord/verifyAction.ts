import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { buildAuthorizeUrl } from "../oauth/fortyTwoClient.js";
import { createState } from "../oauth/stateStore.js";
import { getVerificationByDiscordId } from "../db/database.js";
import { config } from "../config.js";

export const VERIFY_BUTTON_CUSTOM_ID = "verify_start";

export function buildVerifyButtonRow(label: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(VERIFY_BUTTON_CUSTOM_ID).setLabel(label).setStyle(ButtonStyle.Primary)
  );
}

export async function runVerifyFlow(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): Promise<void> {
  const existing = getVerificationByDiscordId(interaction.user.id);

  if (existing) {
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    if (member) {
      const rolesToReconfirm = [config.DISCORD_VERIFIED_ROLE_ID];
      if (config.DISCORD_TRANSCENDER_ROLE_ID && existing.is_transcender) {
        rolesToReconfirm.push(config.DISCORD_TRANSCENDER_ROLE_ID);
      }
      const missing = rolesToReconfirm.filter((id) => !member.roles.cache.has(id));
      if (missing.length > 0) {
        await member.roles.add(missing).catch(() => null);
      }
    }
    await interaction.reply({
      content: `Você já está verificado como \`${existing.intra_login}\`. Role reconfirmada.`,
      ephemeral: true,
    });
    return;
  }

  const state = createState(interaction.user.id);
  const authorizeUrl = buildAuthorizeUrl(state);

  await interaction.reply({
    content: `Clique no link abaixo pra fazer login com sua conta da intra 42 e liberar seu acesso. Link expira em 10 minutos.\n${authorizeUrl}`,
    components: [buildVerifyButtonRow("🔄 Gerar novo link")],
    ephemeral: true,
  });
}
