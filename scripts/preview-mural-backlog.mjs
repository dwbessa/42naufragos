// Dry-run: mostra os projetos fechados que o mural anunciaria agora.
// Não posta nada no Discord. Rode com: node --import tsx scripts/preview-mural-backlog.mjs
import "dotenv/config";
import { config } from "../src/config.ts";
import { getCampusWaitingForCorrection } from "../src/oauth/evaluationsClient.ts";
import { closedProjectMessage } from "../src/services/muralMessages.ts";

const all = await getCampusWaitingForCorrection(config.FT_CAMPUS_ID);
const cutoff = Date.now() - config.MURAL_CLOSED_MAX_AGE_DAYS * 86400000;
const fresh = all.filter((e) => e.markedAt && Date.parse(e.markedAt) >= cutoff);

console.error(
  `\n${all.length} projetos em waiting_for_correction no campus ${config.FT_CAMPUS_ID}` +
    ` — ${fresh.length} fechados nos últimos ${config.MURAL_CLOSED_MAX_AGE_DAYS}d\n`
);

for (const e of fresh) {
  console.log(closedProjectMessage({ login: e.login, project: e.projectName, total: null }));
}
