import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, mergeConfig } from "vite";
import { expect, it, vi } from "vitest";
import configuration from "../../vite.config";

it("compiles TypeScript hooks and TSX components through the application Vite pipeline", async () => {
  // Vitest intentionally disables the compiler in the app config; exercise the
  // client development pipeline with that guard lifted, without opening a port.
  vi.stubEnv("VITEST", undefined);
  let config;
  try {
    config =
      typeof configuration === "function"
        ? await configuration({ command: "serve", mode: "development" })
        : await configuration;
  } finally {
    vi.unstubAllEnvs();
  }
  const cacheDir = await mkdtemp(join(tmpdir(), "alchemy-compiler-test-"));
  try {
    const server = await createServer(
      mergeConfig(config, {
        cacheDir,
        configFile: false,
        server: { middlewareMode: true, preTransformRequests: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      }),
    );
    try {
      for (const path of [
        "/src/components/use-game-translation.ts",
        "/src/features/alchemy/shared/ui/use-pagination.ts",
        "/src/app/save-write-notice.tsx",
      ]) {
        const result = await server.transformRequest(path);
        expect(result?.code, path).toMatch(/react[_/]compiler-runtime/);
      }
    } finally {
      await server.close();
    }
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});
