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
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const remainingMs = deadline - Date.now();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, remainingMs))),
      });
      if (accept(response)) return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) await delay(Math.min(pollMs, remainingMs));
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for HTTP response at ${url}${detail}`);
}
