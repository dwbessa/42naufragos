import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sortSlots,
  ordinalLabel,
  closedProjectMessage,
  upcomingEvaluationMessage,
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
