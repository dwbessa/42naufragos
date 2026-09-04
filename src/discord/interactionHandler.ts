import { Interaction } from "discord.js";
import * as verifyCommand from "./commands/verify.js";

const commands = new Map([[verifyCommand.data.name, verifyCommand]]);

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
    const payload = { content: "Deu erro ao processar o comando. Tenta de novo.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}
