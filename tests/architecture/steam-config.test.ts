import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

interface PlatformsConfig {
  targets: string[];
  appIdEnv: string;
  depotBranch: string;
  devAppId: number;
}

const VALID_TARGETS = new Set(["win", "linux", "mac"]);

describe("steam platform config", () => {
  const config = JSON.parse(readFileSync(join(ROOT, "steam/platforms.json"), "utf8")) as PlatformsConfig;
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { build: Record<string, unknown> };
  const mainSource = readFileSync(join(ROOT, "desktop/main.cjs"), "utf8");

  it("declares at least one shipping target", () => {
    expect(config.targets.length).toBeGreaterThan(0);
    for (const target of config.targets) {
      expect(VALID_TARGETS.has(target)).toBe(true);
    }
  });

  it("maps each target to an electron-builder config block", () => {
    for (const target of config.targets) {
      if (target === "win") {
        expect(pkg.build.win).toBeDefined();
      }
      if (target === "linux") {
        expect(pkg.build.linux).toBeDefined();
      }
      if (target === "mac") {
        expect(pkg.build.mac).toBeDefined();
      }
    }
  });

  it("reads Steam App ID from environment with dev fallback", () => {
    expect(mainSource).toContain("process.env.STEAM_APP_ID");
    expect(mainSource).not.toMatch(/steamworks\.init\(480\)/);
  });

  it("supports optional Azure signing and future fail-closed releases", () => {
    const distDesktop = readFileSync(join(ROOT, "scripts/dist-desktop.mjs"), "utf8");
    expect(distDesktop).toContain("AZURE_CODE_SIGNING_ENDPOINT");
    expect(distDesktop).toContain("forceCodeSigning=true");
    expect(distDesktop).toContain('"electron-builder", "out", "cli", "cli.js"');
    expect(distDesktop).not.toContain('"npx.cmd"');
    expect(JSON.stringify(pkg.build)).not.toContain('"signAndEditExecutable":false');
  });
});
