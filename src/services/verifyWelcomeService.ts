import { ChannelType } from "discord.js";
import { client } from "../discord/client.js";
import { config } from "../config.js";
import { buildVerifyButtonRow } from "../discord/verifyAction.js";

const WELCOME_MARKER = "🔐 **Verificação 42 Rio**";

export async function ensureVerifyWelcomeMessage(): Promise<void> {
  const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  const channel = channels.find(
    (c) => c?.type === ChannelType.GuildText && c.name === "verificação"
  );
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const alreadyPosted = recent?.some(
    (m) => m.author.id === client.user?.id && m.content.startsWith(WELCOME_MARKER)
  );
  if (alreadyPosted) return;

  await channel.send({
    content: `${WELCOME_MARKER}\nClique no botão abaixo pra vincular sua conta da intra 42 e liberar acesso ao servidor.`,
    components: [buildVerifyButtonRow("🔐 Verificar com a 42")],
  });
}
