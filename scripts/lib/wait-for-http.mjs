import { setTimeout as delay } from "node:timers/promises";

/**
 * Poll an HTTP endpoint until it accepts a response or the deadline expires.
 * The response is returned so callers can reuse the successful request.
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, pollMs?: number, requestTimeoutMs?: number, accept?: (response: Response) => boolean }} [options]
 * @returns {Promise<Response>}
 */
export async function waitForHttp(url, options = {}) {
  const { timeoutMs = 60_000, pollMs = 250, requestTimeoutMs = 1_000, accept = (response) => response.ok } = options;
  for (const [name, value, minimum] of [
    ["timeoutMs", timeoutMs, 0],
    ["pollMs", pollMs, 0],
    ["requestTimeoutMs", requestTimeoutMs, 1],
  ]) {
    // Node timers overflow above a signed 32-bit delay and fire after 1ms instead.
    if (!Number.isInteger(value) || value < minimum || value > 2_147_483_647) {
      throw new RangeError(`${name} must be an integer between ${minimum} and 2147483647`);
    }
  }
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const remainingMs = deadline - Date.now();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remainingMs))),
      });
      let accepted = false;
      try {
        accepted = accept(response);
        if (!accepted) {
          lastError = new Error(`HTTP ${response.status} ${response.statusText} rejected by readiness check`.trim());
        }
      } finally {
        if (!accepted) await response.body?.cancel();
      }
      if (accepted) return response;
    } catch (error) {
      lastError = error;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) await delay(Math.min(pollMs, remainingMs));
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for HTTP response at ${url}${detail}`);
}
