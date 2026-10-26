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
    "PLAYWRIGHT_NIGHTLY",
    "PLAYWRIGHT_PREPUSH",
    "PLAYWRIGHT_COLD_BOOT",
    "PLAYWRIGHT_VITE_MODE",
    "PLAYWRIGHT_BROWSER_PREVIEW_PORT",
    "PLAYWRIGHT_ELECTRON_PREVIEW_PORT",
    "PLAYWRIGHT_ELECTRON_FULL",
    "PLAYWRIGHT_PERF_PORT",
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv("ALCHEMY_RUN_ID", "playwright-config-test");
});

afterEach(() => vi.unstubAllEnvs());

describe("Playwright server configuration", () => {
  it.each(["e2e", "performance"] as const)("owns the %s server locally and in CI", (preset) => {
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

  it("caps push-CI browser execution at two workers for animation headroom", () => {
    vi.stubEnv("CI", "true");
    expect(configFor().workers).toBe(2);
    vi.stubEnv("GITHUB_SHA", "reviewed-commit");
    vi.stubEnv("ALCHEMY_CI_SETUP_STARTED_AT", "2026-10-10T12:00:00Z");
    expect(configFor().metadata).toMatchObject({
      runId: "playwright-config-test",
      commit: "reviewed-commit",
      setupStartedAt: "2026-10-10T12:00:00Z",
    });
  });

  it("runs packaged Electron without a preview server", () => {
    expect(createAlchemyPlaywrightConfig("electron").webServer).toBeUndefined();
  });

  it("collects one local Electron smoke unless a CI job explicitly selects the full suite", () => {
    expect(createAlchemyPlaywrightConfig("electron").grep?.toString()).toBe("/@local-electron-smoke/");
    vi.stubEnv("CI", "true");
    expect(createAlchemyPlaywrightConfig("electron").grep?.toString()).toBe("/@local-electron-smoke/");
    vi.stubEnv("PLAYWRIGHT_ELECTRON_FULL", "1");
    expect(createAlchemyPlaywrightConfig("electron").grep).toBeUndefined();
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

it("keeps deeper interaction journeys nightly while retaining existing Electron tiers", () => {
  vi.stubEnv("PLAYWRIGHT_ELECTRON_FULL", "1");
  vi.stubEnv("ALCHEMY_INTERACTION_TIER", "push");
  const push = createAlchemyPlaywrightConfig("electron");
  expect(push.grep).toBeUndefined();
  expect(String(push.grepInvert)).toContain("@interaction-nightly");
  vi.stubEnv("ALCHEMY_INTERACTION_TIER", "nightly");
  expect(createAlchemyPlaywrightConfig("electron").grepInvert).toBeUndefined();
});

// Collection exercises the real specs and inherited tags without launching a browser.
it("gates every localization risk once and keeps QA coverage out of production smoke", async () => {
  const output = await new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "--list",
        "--project=chromium",
        "--reporter=json",
        "tests/e2e/specs/localization.spec.ts",
        "tests/e2e/specs/localization-gameplay.spec.ts",
        "tests/e2e/specs/localization-demo.spec.ts",
        "tests/e2e/specs/steam-demo.spec.ts",
      ],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        env: { ...process.env, CI: "true" },
        timeout: 20_000,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
  interface Spec {
    title: string;
    tags: string[];
  }
  interface Suite {
    title?: string;
    specs?: Spec[];
    suites?: Suite[];
    errors?: unknown[];
  }
  const report = JSON.parse(output) as Suite;
  expect(report.errors).toEqual([]);
  const journeys = new Map<string, Spec[]>();
  const locales = new Set<string>();
  const gameplay = new Map<string, string[]>();
  const demoCore: Spec[] = [];
  const collect = (suite: Suite) => {
    for (const spec of suite.specs ?? []) {
      if (suite.title === "Steam demo edition") {
        demoCore.push(spec);
        expect(spec.tags).toContain("critical");
        continue;
      }
      expect(spec.tags).toContain("localization");
      expect(spec.tags).not.toContain("critical");
      const locale = spec.title.match(/^(de|zh-Hans|ru|es|pt-BR|ja|fr|en-XA) /u)?.[1] ?? suite.title;
      if (spec.tags.includes("localization-smoke")) {
        expect(locale).not.toBe("en-XA");
        locales.add(locale!);
      }
      expect(spec.tags.includes("localization-qa")).toBe(locale === "en-XA");
      const risk = spec.title.replace(/^(de|zh-Hans|ru|es|pt-BR|ja|fr|en-XA) /u, "");
      journeys.set(risk, [...(journeys.get(risk) ?? []), spec]);
      if (suite.title && /^(de|zh-Hans|ru|es|pt-BR|ja|fr|en-XA)$/u.test(suite.title)) {
        gameplay.set(risk, [...(gameplay.get(risk) ?? []), locale!]);
      }
    }
    for (const child of suite.suites ?? []) collect(child);
  };
  collect(report);
  expect(demoCore).toHaveLength(5);
  expect([...locales].sort()).toEqual(["de", "es", "fr", "ja", "pt-BR", "ru", "zh-Hans"]);
  expect(journeys.size).toBeGreaterThan(0);
  expect(gameplay.size).toBe(9);
  for (const [risk, languages] of gameplay) {
    expect(languages, risk).toHaveLength(2);
    expect(languages, risk).toContain("en-XA");
  }
  for (const [risk, variants] of journeys) {
    const representatives = variants.filter((spec) => spec.tags.includes("localization-smoke"));
    // Options also loads each independent bundled script font in the renderer.
    if (risk === "Options tabs fit and keep translated controls usable") {
      expect(representatives.map((spec) => spec.title.split(" ")[0]).sort()).toEqual(["ja", "ru", "zh-Hans"]);
    } else expect(representatives, risk).toHaveLength(1);
  }
}, 30_000);
