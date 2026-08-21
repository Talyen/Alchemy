// Polls the Vite dev server until it responds (respects ALCHEMY_DEV_PORT).
import { waitForHttp } from "./lib/wait-for-http.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

export async function waitForDevServer({ port = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10) } = {}) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ALCHEMY_DEV_PORT: ${port}`);
  }

  const url = `http://127.0.0.1:${port}`;
  await waitForHttp(url, { timeoutMs: 60_000, accept: () => true });
}

if (isMainModule(import.meta.url)) {
  waitForDevServer().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
