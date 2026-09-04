import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { runVerifyFlow } from "../verifyAction.js";

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Vincule sua conta da intra 42 pra liberar acesso ao servidor");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await runVerifyFlow(interaction);
}
