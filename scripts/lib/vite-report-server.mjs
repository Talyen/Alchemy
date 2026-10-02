import { resolveEdition } from "../../game-edition.mjs";
import path from "node:path";
import { createServer } from "vite";

/**
 * Shared middleware-mode Vite server for SSR report generation (balance and
 * loot reports). Boots with the `@` → src alias, runs `fn`, then always
 * closes the server so entry modules stay import-safe under `defineScript`.
 */
export async function withReportServer(fn) {
  const server = await createServer({
    root: path.resolve(import.meta.dirname, "../.."),
    configFile: false,
    define: { __ALCHEMY_EDITION__: JSON.stringify(resolveEdition(process.env.ALCHEMY_EDITION)) },
    appType: "custom",
    // SSR reports never serve a browser. Avoid racing native dependency scans
    // against shutdown when a short report finishes before the scan completes.
    optimizeDeps: { noDiscovery: true, include: [] },
    // One-shot reports need no watcher; native watcher teardown can crash Node on exit.
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
  });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}
