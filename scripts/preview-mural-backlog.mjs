// Dry-run: mostra o backlog que o mural postaria na primeira varredura do campus.
// Não posta nada no Discord. Rode com: node --import tsx scripts/preview-mural-backlog.mjs
import "dotenv/config";
import { config } from "../src/config.ts";
import { getCampusWaitingForCorrection } from "../src/oauth/evaluationsClient.ts";
import { backlogMessages } from "../src/services/muralMessages.ts";

const entries = await getCampusWaitingForCorrection(
  config.FT_CAMPUS_ID,
  config.MURAL_CLOSED_MAX_AGE_DAYS
);
console.error(
  `\n${entries.length} projetos fechados nos últimos ${config.MURAL_CLOSED_MAX_AGE_DAYS}d no campus ${config.FT_CAMPUS_ID}\n`
);

const backlog = entries.map((e) => ({ login: e.login, project: e.projectName, total: null }));

const chunks = backlogMessages(backlog);
console.error(`--- ${chunks.length} mensagem(ns) seriam postadas ---\n`);
chunks.forEach((c, i) => {
  console.log(`━━━━━━━━━━ mensagem ${i + 1}/${chunks.length} (${c.length} chars) ━━━━━━━━━━`);
  console.log(c);
  console.log();
});
