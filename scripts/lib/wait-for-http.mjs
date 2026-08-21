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
      const response = await fetch(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
      if (accept(response)) return response;
    } catch (error) {
      lastError = error;
    }
    await delay(pollMs);
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for HTTP response at ${url}${detail}`);
}
