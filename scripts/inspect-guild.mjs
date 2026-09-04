import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const roles = await guild.roles.fetch();
  console.log("--- roles (id, name, position) ---");
  [...roles.values()].sort((a, b) => b.position - a.position).forEach((r) => console.log(r.id, r.name, r.position, "managed=" + r.managed));
  const channels = await guild.channels.fetch();
  console.log("--- channels (id, type, name, parentId) ---");
  [...channels.values()].forEach((c) => console.log(c.id, c.type, c.name, c.parentId));
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
