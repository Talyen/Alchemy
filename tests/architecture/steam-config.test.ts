import { describe, expect, it } from "vitest";
import { readText } from "./helpers";

interface PlatformsConfig {
  targets: string[];
  appIdEnv: string;
  depotBranch: string;
  devAppId: number;
}

const VALID_TARGETS = new Set(["win", "linux", "mac"]);

describe("steam platform config", () => {
  const config = JSON.parse(readText("steam/platforms.json")) as PlatformsConfig;
  const pkg = JSON.parse(readText("package.json")) as {
    build: Record<string, unknown>;
    scripts: Record<string, string>;
  };
  const mainSource = readText("desktop/main.cjs");

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

  it("validates the desktop build config and never publishes from local packaging", () => {
    const distDesktop = readText("scripts/dist-desktop.mjs");
    expect(distDesktop).toContain("validateDesktopBuildConfig()");
    expect(distDesktop).toContain('["--publish", "never"]');
  });

  it("routes packaging through dist-desktop rather than direct electron-builder scripts", () => {
    expect(pkg.scripts["dist:desktop"]).toContain("dist-desktop.mjs");
    expect(pkg.scripts["package:win"]).toContain("dist:desktop");
    expect(pkg.scripts["package:win"]).toContain("--dir");
    const directBuilderScripts = Object.entries(pkg.scripts).filter(
      ([name, command]) =>
        name !== "dist:desktop" && /\belectron-builder\b/u.test(command) && !command.includes("dist-desktop"),
    );
    expect(directBuilderScripts.map(([name]) => name)).toEqual([]);
  });
});
