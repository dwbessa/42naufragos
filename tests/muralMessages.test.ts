import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sortSlots,
  ordinalLabel,
  closedProjectMessage,
  upcomingEvaluationMessage,
  backlogMessages,
} from "../src/services/muralMessages.ts";

const slot = (id: number, begin_at: string, filled_at: string | null = null) => ({
  id,
  begin_at,
  filled_at,
});

test("sortSlots ordena por begin_at e desempata por id", () => {
  const out = sortSlots([
    slot(3, "2026-09-07T15:00:00Z"),
    slot(1, "2026-09-07T12:00:00Z"),
    slot(2, "2026-09-07T12:00:00Z"),
  ]);
  assert.deepEqual(out.map((s) => s.id), [1, 2, 3]);
});

test("ordinalLabel mostra X/N quando cabe, senão só X", () => {
  assert.equal(ordinalLabel(1, 3), "1/3");
  assert.equal(ordinalLabel(3, 3), "3/3");
  assert.equal(ordinalLabel(2, null), "2");
  assert.equal(ordinalLabel(4, 3), "4"); // retry além do exigido
});

test("closedProjectMessage com e sem total", () => {
  assert.equal(
    closedProjectMessage({ login: "jdoe", project: "ft_transcendence", total: 3 }),
    "🚪 **jdoe** fechou **ft_transcendence** — avaliações abertas! (precisa de 3 correções)"
  );
  assert.equal(
    closedProjectMessage({ login: "jdoe", project: "philosophers", total: 2 }),
    "🚪 **jdoe** fechou **philosophers** — avaliações abertas! (precisa de 2 correções)"
  );
  assert.equal(
    closedProjectMessage({ login: "jdoe", project: "x", total: null }),
    "🚪 **jdoe** fechou **x** — avaliações abertas!"
  );
});

test("backlogMessages: vazio -> nenhuma mensagem", () => {
  assert.deepEqual(backlogMessages([]), []);
});

test("backlogMessages: uma mensagem com header e bullets", () => {
  const out = backlogMessages([
    { login: "a", project: "philosophers", total: 2 },
    { login: "b", project: "cub3d", total: null },
  ]);
  assert.equal(out.length, 1);
  assert.match(out[0], /Projetos abertos aguardando correção/);
  assert.match(out[0], /• \*\*a\*\* — \*\*philosophers\*\* \(precisa de 2 correções\)/);
  assert.match(out[0], /• \*\*b\*\* — \*\*cub3d\*\*$/m);
});

test("backlogMessages: quebra em várias quando passa do limite", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({
    login: `user${i}`,
    project: `projeto_bem_longo_numero_${i}`,
    total: 3,
  }));
  const out = backlogMessages(many);
  assert.ok(out.length > 1);
  for (const chunk of out) assert.ok(chunk.length <= 1900);
});

test("upcomingEvaluationMessage inclui o ordinal", () => {
  const msg = upcomingEvaluationMessage({
    login: "jdoe",
    project: "minishell",
    ordinal: "2/3",
    beginAt: "2026-09-07T17:00:00Z",
  });
  assert.match(msg, /avaliação \*\*2\/3\*\* de \*\*minishell\*\*/);
  assert.match(msg, /07\/09/);
});
