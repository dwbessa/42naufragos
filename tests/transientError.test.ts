import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransientError } from "../src/lib/transientError.ts";

test("reconhece códigos de rede transitórios", () => {
  assert.equal(isTransientError(Object.assign(new Error("x"), { code: "ECONNRESET" })), true);
  assert.equal(isTransientError(Object.assign(new Error("x"), { code: "EAI_AGAIN" })), true);
  assert.equal(isTransientError(Object.assign(new Error("x"), { code: "UND_ERR_SOCKET" })), true);
});

test("reconhece mensagens transitórias", () => {
  assert.equal(isTransientError(new Error("socket hang up")), true);
  assert.equal(isTransientError(new Error("Opening handshake has timed out")), true);
});

test("desce em error.cause aninhado", () => {
  const outer = new Error("request to https://api.intra.42.fr failed", {
    cause: Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
  });
  assert.equal(isTransientError(outer), true);
});

test("desce em AggregateError", () => {
  const agg = new AggregateError([
    Object.assign(new Error("a"), { code: "ENETUNREACH" }),
    new Error("b"),
  ]);
  assert.equal(isTransientError(agg), true);
});

test("não marca bugs de código como transitórios", () => {
  assert.equal(isTransientError(new TypeError("Cannot read properties of undefined")), false);
  assert.equal(isTransientError(new Error("something exploded")), false);
  assert.equal(isTransientError(Object.assign(new Error("x"), { code: "ERR_INVALID_ARG_TYPE" })), false);
  assert.equal(isTransientError(null), false);
  assert.equal(isTransientError("just a string"), false);
});
