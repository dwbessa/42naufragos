import { config } from "./config.js";
import { client, startDiscordClient } from "./discord/client.js";
import { handleInteraction } from "./discord/interactionHandler.js";
import { createServer } from "./web/server.js";
import { pollUpcomingEvaluations } from "./services/evaluationMuralService.js";
import "./db/database.js";

let muralInterval: NodeJS.Timeout | undefined;

client.once("ready", () => {
  console.log(`Bot online como ${client.user?.tag}`);

  if (config.DISCORD_MURAL_CHANNEL_ID) {
    void pollUpcomingEvaluations().catch((error) => console.error("Erro no polling do mural:", error));
    muralInterval = setInterval(
      () => void pollUpcomingEvaluations().catch((error) => console.error("Erro no polling do mural:", error)),
      config.MURAL_POLL_MINUTES * 60 * 1000
    );
  }
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
  if (muralInterval) clearInterval(muralInterval);
  server.close();
  await client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await startDiscordClient();
