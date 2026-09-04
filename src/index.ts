import { config } from "./config.js";
import { client, startDiscordClient } from "./discord/client.js";
import { handleInteraction } from "./discord/interactionHandler.js";
import { createServer } from "./web/server.js";
import "./db/database.js";

client.once("ready", () => {
  console.log(`Bot online como ${client.user?.tag}`);
});

client.on("interactionCreate", (interaction) => {
  void handleInteraction(interaction);
});

const app = createServer();
const server = app.listen(config.PORT, () => {
  console.log(`Servidor HTTP escutando na porta ${config.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Recebido ${signal}, encerrando...`);
  server.close();
  await client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await startDiscordClient();
