// Erros de rede pontuais (reset de conexão, DNS temporário, timeout de socket)
// não são bug: acontecem em prod e o processo se recupera sozinho na próxima
// tentativa. Distinguimos esses de exceções "de verdade" pra não derrubar o
// processo à toa (uncaughtException handler em src/index.ts).

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNABORTED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /socket hang up/i,
  /network socket disconnected/i,
  /opening handshake has timed out/i,
  /the operation was aborted/i,
  /getaddrinfo (?:eai_again|enotfound)/i,
  /connect (?:etimedout|econnrefused)/i,
  /request to .* failed/i,
];

function collectStrings(error: unknown, depth = 0): { codes: string[]; messages: string[] } {
  const codes: string[] = [];
  const messages: string[] = [];

  if (depth > 5 || error === null || typeof error !== "object") {
    return { codes, messages };
  }

  const err = error as { code?: unknown; message?: unknown; cause?: unknown; errors?: unknown };

  if (typeof err.code === "string") codes.push(err.code);
  if (typeof err.message === "string") messages.push(err.message);

  if (err.cause) {
    const nested = collectStrings(err.cause, depth + 1);
    codes.push(...nested.codes);
    messages.push(...nested.messages);
  }

  // AggregateError (ex: undici tentando múltiplos IPs)
  if (Array.isArray(err.errors)) {
    for (const inner of err.errors) {
      const nested = collectStrings(inner, depth + 1);
      codes.push(...nested.codes);
      messages.push(...nested.messages);
    }
  }

  return { codes, messages };
}

export function isTransientError(error: unknown): boolean {
  const { codes, messages } = collectStrings(error);

  if (codes.some((code) => TRANSIENT_CODES.has(code))) return true;
  if (messages.some((msg) => TRANSIENT_MESSAGE_PATTERNS.some((re) => re.test(msg)))) return true;

  return false;
}
