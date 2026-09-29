import path from "node:path";
import { createServer } from "vite";

/**
 * Shared middleware-mode Vite server for SSR report generation (balance and
 * loot reports). Boots with the `@` → src alias, runs `fn`, then always
 * closes the server so entry modules stay import-safe under `defineScript`.
 */
export async function withReportServer(fn) {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
  });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}
