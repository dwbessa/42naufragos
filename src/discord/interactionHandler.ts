import { Interaction } from "discord.js";
import * as verifyCommand from "./commands/verify.js";
import { runVerifyFlow, VERIFY_BUTTON_CUSTOM_ID } from "./verifyAction.js";

const commands = new Map([[verifyCommand.data.name, verifyCommand]]);

async function replyWithError(interaction: Interaction, error: unknown, label: string): Promise<void> {
  console.error(`Erro ao processar ${label}:`, error);
  if (!interaction.isRepliable()) return;
  const payload = { content: "Deu erro ao processar. Tenta de novo.", ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => null);
  } else {
    await interaction.reply(payload).catch(() => null);
  }
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      await replyWithError(interaction, error, `comando ${interaction.commandName}`);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_CUSTOM_ID) {
    try {
      await runVerifyFlow(interaction);
    } catch (error) {
      await replyWithError(interaction, error, "botão de verificação");
    }
  }
}
