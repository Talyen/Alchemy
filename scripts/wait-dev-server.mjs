// Polls the Vite dev server until it responds (respects ALCHEMY_DEV_PORT).
import { setTimeout as delay } from "node:timers/promises";

const port = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);
const TIMEOUT_MS = 60_000;
const POLL_MS = 250;

async function waitForDevServer() {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ALCHEMY_DEV_PORT: ${process.env.ALCHEMY_DEV_PORT}`);
  }

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await delay(POLL_MS);
    }
  }

  throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s waiting for Vite at ${url}`);
}

waitForDevServer().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
