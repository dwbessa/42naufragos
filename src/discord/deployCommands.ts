import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { data as verifyCommand } from "./commands/verify.js";

const commands = [verifyCommand.toJSON()];

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

async function main() {
  console.log(`Registrando ${commands.length} slash command(s) na guild ${config.DISCORD_GUILD_ID}...`);
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body: commands }
  );
  console.log("Comandos registrados com sucesso.");
}

main().catch((error) => {
  console.error("Falha ao registrar comandos:", error);
  process.exit(1);
});
