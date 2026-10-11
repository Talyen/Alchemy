import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeConfig, resolveConfig, type UserConfig } from "vite";
import configuration from "../../vite.config";

// Configuration resolution exercises CLI overrides without building or uploading.
vi.mock("@sentry/vite-plugin", () => ({ sentryVitePlugin: () => [] }));

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (/^(SENTRY_|AZURE_|STEAM_|ALCHEMY_)/u.test(key)) vi.stubEnv(key, undefined);
  }
  vi.stubEnv("CI_RELEASE", "true");
  vi.stubEnv("STEAM_APP_ID", "1234");
  vi.stubEnv("STEAM_DEPOT_ID", "1235");
  vi.stubEnv("STEAM_DEMO_APP_ID", "5678");
  vi.stubEnv("STEAM_DEMO_DEPOT_ID", "5679");
});
afterEach(() => vi.unstubAllEnvs());

async function desktopConfig(overrides: UserConfig = {}) {
  const config =
    typeof configuration === "function"
      ? await configuration({ command: "build", mode: "desktop" })
      : await configuration;
  return resolveConfig(mergeConfig(config, { ...overrides, configFile: false, mode: "desktop" }), "build");
}

function enableReporting() {
  vi.stubEnv("SENTRY_DSN", "https://public@example.com/1");
  vi.stubEnv("SENTRY_AUTH_TOKEN", "test-token");
  vi.stubEnv("SENTRY_ORG", "test-org");
  vi.stubEnv("SENTRY_PROJECT", "test-project");
}

describe("resolved desktop release configuration", () => {
  it.each(["full", "demo"])("uses hidden maps in the %s edition's packaging directory", async (edition) => {
    vi.stubEnv("ALCHEMY_EDITION", edition);
    enableReporting();
    const config = await desktopConfig();
    expect(config.build.sourcemap).toBe("hidden");
    expect(resolve(config.root, config.build.outDir)).toBe(
      resolve(import.meta.dirname, "../..", edition === "demo" ? "dist-demo" : "dist"),
    );
  });

  it.each([false, true, "inline"] as const)("rejects the source-map override %s with reporting", async (sourcemap) => {
    enableReporting();
    await expect(desktopConfig({ build: { sourcemap } })).rejects.toThrow(
      sourcemap === "inline" ? "inline source maps" : "hidden source maps",
    );
  });

  it("rejects inline sources even when crash reporting is disabled", async () => {
    await expect(desktopConfig({ build: { sourcemap: "inline" } })).rejects.toThrow("inline source maps");
  });

  it.each(["full", "demo"])("rejects writing the %s release outside its packaging directory", async (edition) => {
    vi.stubEnv("ALCHEMY_EDITION", edition);
    await expect(desktopConfig({ build: { outDir: "custom-output" } })).rejects.toThrow("renderer directory");
  });

  it("permits releases without maps when reporting is disabled", async () => {
    vi.stubEnv("ALCHEMY_SKIP_SOURCEMAP", "1");
    expect((await desktopConfig()).build.sourcemap).toBe(false);
  });

  it("preserves local source-map and output overrides", async () => {
    vi.stubEnv("CI_RELEASE", "false");
    const config = await desktopConfig({ build: { sourcemap: "inline", outDir: "custom-output" } });
    expect(config.build.sourcemap).toBe("inline");
    expect(config.build.outDir).toBe("custom-output");
  });
});
