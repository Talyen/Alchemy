// Polls for a successful Vite response before launching Electron (respects ALCHEMY_DEV_PORT).
import { resolveDevPort } from "./lib/dev-port.mjs";
import { waitForHttp } from "./lib/wait-for-http.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

export async function waitForDevServer({ port = resolveDevPort() } = {}) {
  const url = `http://127.0.0.1:${port}`;
  const response = await waitForHttp(url, { timeoutMs: 60_000 });
  await response.body?.cancel();
}

if (isMainModule(import.meta.url)) {
  waitForDevServer().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
