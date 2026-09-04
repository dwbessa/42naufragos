import { Client, GatewayIntentBits } from "discord.js";
import { config } from "../config.js";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

export async function startDiscordClient(): Promise<void> {
  await client.login(config.DISCORD_TOKEN);
}
