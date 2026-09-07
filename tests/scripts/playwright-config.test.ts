import { execFile } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAlchemyPlaywrightConfig, type AlchemyPlaywrightPreset } from "../playwright-shared";

const require = createRequire(import.meta.url);

function configFor(preset: AlchemyPlaywrightPreset = "e2e") {
  const config = createAlchemyPlaywrightConfig(preset);
  const webServer = config.webServer;
  if (!webServer || Array.isArray(webServer)) throw new Error("Expected one owned server per preset");
  return { ...config, webServer };
}

beforeEach(() => {
  for (const name of [
    "CI",
    "PLAYWRIGHT_PREPUSH",
    "PLAYWRIGHT_COLD_BOOT",
    "PLAYWRIGHT_VITE_MODE",
    "PLAYWRIGHT_BROWSER_PREVIEW_PORT",
    "PLAYWRIGHT_ELECTRON_PREVIEW_PORT",
    "PLAYWRIGHT_PERF_PORT",
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv("ALCHEMY_RUN_ID", "playwright-config-test");
});

afterEach(() => vi.unstubAllEnvs());

describe("Playwright server configuration", () => {
  it.each(["e2e", "electron", "performance"] as const)("owns the %s server locally and in CI", (preset) => {
    expect(configFor(preset).webServer.reuseExistingServer).toBe(false);
    vi.stubEnv("CI", "true");
    expect(configFor(preset).webServer.reuseExistingServer).toBe(false);
    vi.stubEnv("PLAYWRIGHT_PREPUSH", "1");
    expect(configFor(preset).webServer.reuseExistingServer).toBe(false);
  });

  it.each([undefined, "4273"])("keeps browser connection and storage on port %s", (override) => {
    vi.stubEnv("PLAYWRIGHT_BROWSER_PREVIEW_PORT", override);
    const port = override ? Number(override) : 4173;
    const config = configFor();
    expect(config.webServer).toMatchObject({
      port,
      command: `vite preview --host 127.0.0.1 --port ${port} --strictPort`,
      env: { ALCHEMY_DEV_PORT: String(port) },
    });
    expect(config.use).toMatchObject({
      baseURL: `http://127.0.0.1:${port}`,
      storageState: {
        origins: [
          {
            origin: `http://127.0.0.1:${port}`,
            localStorage: [{ name: "alchemy-skip-loading-screen", value: "true" }],
          },
        ],
      },
    });
  });

  it("starts development mode on the overridden port", () => {
    vi.stubEnv("PLAYWRIGHT_VITE_MODE", "dev");
    vi.stubEnv("PLAYWRIGHT_BROWSER_PREVIEW_PORT", "4273");
    expect(configFor().webServer.command).toBe("vite --host 127.0.0.1 --port 4273 --strictPort");
  });

  it.each(["", "4173junk", "65536"])("rejects invalid browser port %s", (port) => {
    vi.stubEnv("PLAYWRIGHT_BROWSER_PREVIEW_PORT", port);
    expect(() => configFor()).toThrow("Invalid PLAYWRIGHT_BROWSER_PREVIEW_PORT");
  });

  it("rejects an occupied port before tests run and leaves its listener alive", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "alchemy-playwright-ownership-"));
    const server = createServer((_request, response) => response.end("existing server"));
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
      vi.stubEnv("PLAYWRIGHT_BROWSER_PREVIEW_PORT", String(address.port));
      const configPath = path.join(directory, "playwright.config.mjs");
      const markerPath = path.join(directory, "test-ran");
      writeFileSync(
        configPath,
        `export default ${JSON.stringify({
          testDir: directory,
          testMatch: "ownership.spec.mjs",
          outputDir: path.join(directory, "output"),
          reporter: "line",
          webServer: configFor().webServer,
        })};`,
      );
      writeFileSync(
        path.join(directory, "ownership.spec.mjs"),
        [
          `import { test } from ${JSON.stringify(pathToFileURL(require.resolve("@playwright/test")).href)};`,
          'import { writeFileSync } from "node:fs";',
          `test("records execution", () => writeFileSync(${JSON.stringify(markerPath)}, "ran"));`,
        ].join("\n"),
      );
      const result = await new Promise<{ code: string | number | null | undefined; output: string }>((resolve) => {
        execFile(
          process.execPath,
          [require.resolve("@playwright/test/cli"), "test", "--config", configPath],
          {
            cwd: directory,
            timeout: 15_000,
            env: { ...process.env, FORCE_COLOR: "0" },
          },
          (error, stdout, stderr) => resolve({ code: error?.code, output: stdout + stderr }),
        );
      });
      expect(result.code).toBe(1);
      expect(result.output).toContain("is already used");
      expect(existsSync(markerPath)).toBe(false);
      expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe("existing server");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
