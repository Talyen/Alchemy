import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateDesktopBuildConfig } from "../../scripts/lib/desktop-build-config.mjs";

const release = { CI_RELEASE: "true", STEAM_APP_ID: "123456" };
const sentry = { SENTRY_DSN: "dsn", SENTRY_AUTH_TOKEN: "token", SENTRY_ORG: "org", SENTRY_PROJECT: "project" };

describe("desktop build configuration", () => {
  it.each([
    ["--desktop", "--mode", "production"],
    ["--desktop", "--mode=production"],
    ["--desktop", "-m", "production"],
    ["--mode=desktop", "--mode", "production"],
    ["--mode", "production", "--mode=desktop"],
  ])("rejects conflicting target options before any work (%j)", (...args) => {
    const result = spawnSync(process.execPath, ["scripts/build-verified.mjs", ...args], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Conflicting build modes");
    expect(result.stdout).toBe("");
  });

  it("accepts local builds and releases with optional crash reporting", () => {
    expect(validateDesktopBuildConfig({}).sentryUploadEnabled).toBe(false);
    expect(validateDesktopBuildConfig(release).steamAppId).toBe("123456");
    expect(validateDesktopBuildConfig({ ...release, ...sentry }).sentryUploadEnabled).toBe(true);
    expect(validateDesktopBuildConfig({ ...sentry, ALCHEMY_SKIP_SOURCEMAP: "1" }).sentryUploadEnabled).toBe(true);
    expect(validateDesktopBuildConfig({ ...release, ALCHEMY_SKIP_SOURCEMAP: "1" }).sentryUploadEnabled).toBe(false);
    expect(validateDesktopBuildConfig({ ...release, STEAM_APP_ID: " 00123456 " }).steamAppId).toBe("00123456");
  });

  it.each(["", "abc", "-1", "0", "480garbage", "0480", "1.5", "1e6", "0x123", "9007199254740992"])(
    "rejects invalid production Steam App ID %j",
    (steamAppId) => {
      expect(() => validateDesktopBuildConfig({ ...release, STEAM_APP_ID: steamAppId })).toThrow(
        "production Steam App ID",
      );
    },
  );

  it.each([
    [{ ...release, STEAM_APP_ID: "480" }, "production Steam App ID"],
    [{ CI_RELEASE: "true" }, "production Steam App ID"],
    [{ ...release, SENTRY_AUTH_TOKEN: "token" }, "configuration is partial"],
    [{ ...release, SENTRY_DSN: "dsn" }, "both the public DSN"],
    [{ ...release, ...sentry, SENTRY_DSN: "" }, "both the public DSN"],
    [{ ...release, ...sentry, ALCHEMY_SKIP_SOURCEMAP: "1" }, "requires source maps"],
    [{ ...release, AZURE_CODE_SIGNING_ENDPOINT: "endpoint" }, "all four public signing values"],
  ] as const)("rejects incomplete release settings: %j", (env, message) => {
    expect(() => validateDesktopBuildConfig(env)).toThrow(message);
  });

  it.each([["--desktop"], ["--mode", "desktop"], ["--mode=desktop"]])(
    "rejects invalid configuration before generated checks or Vite (%j)",
    (...args) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(SENTRY_|AZURE_)/u.test(key)));
      const result = spawnSync(process.execPath, ["scripts/build-verified.mjs", ...args], {
        cwd: new URL("../..", import.meta.url),
        env: { ...env, ...release, AZURE_CODE_SIGNING_ENDPOINT: "endpoint" },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("all four public signing values");
      expect(result.stdout).toBe("");
    },
  );
});
