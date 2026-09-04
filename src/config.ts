import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_VERIFIED_ROLE_ID: z.string().min(1),
  DISCORD_TRANSCENDER_ROLE_ID: z.string().min(1).optional(),
  FT_CLIENT_ID: z.string().min(1),
  FT_CLIENT_SECRET: z.string().min(1),
  FT_CAMPUS_ID: z.coerce.number().int().positive(),
  FT_MAIN_CURSUS_SLUG: z.string().min(1).default("42cursus"),
  PUBLIC_BASE_URL: z.string().url(),
  OAUTH_REDIRECT_URI: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/naufragos.sqlite"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Env vars inválidas ou faltando:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
