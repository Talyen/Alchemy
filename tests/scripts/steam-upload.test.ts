import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSteamContentRoot } from "../../scripts/lib/steam-vdf.mjs";

const ROOT = join(import.meta.dirname, "../..");
const contentRoot = resolveSteamContentRoot(ROOT);
const buildDir = join(ROOT, "steam/build");

function ensureFakeWinUnpacked() {
  mkdirSync(contentRoot, { recursive: true });
  writeFileSync(join(contentRoot, "Alchemy.exe"), "");
}

afterEach(() => {
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(contentRoot, { recursive: true, force: true });
});

describe("steam-upload script", () => {
  it("dry-runs without Steam credentials and writes substituted VDFs when contentroot is valid", () => {
    ensureFakeWinUnpacked();
    const result = spawnSync("node", ["scripts/steam-upload.mjs"], {
      cwd: ROOT,
      env: { ...process.env, STEAM_UPLOAD_DRY_RUN: "1", STEAM_APP_ID: "42", STEAM_DEPOT_ID: "7" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const appPath = join(ROOT, "steam/build/app_build.vdf");
    expect(existsSync(appPath)).toBe(true);
    const appVdf = readFileSync(appPath, "utf8");
    expect(appVdf).toContain('"appid" "42"');
    expect(appVdf).not.toContain("${STEAM_APP_ID}");
    expect(appVdf).toContain(`"contentroot" "${contentRoot.replaceAll("\\", "/")}"`);
    expect(appVdf).toContain('"setlive" ""');
    expect(result.stdout).toContain("contentroot OK:");
  });

  it("fails dry-run with a clear error when win-unpacked is missing", () => {
    rmSync(contentRoot, { recursive: true, force: true });
    const result = spawnSync("node", ["scripts/steam-upload.mjs"], {
      cwd: ROOT,
      env: { ...process.env, STEAM_UPLOAD_DRY_RUN: "1", STEAM_APP_ID: "42", STEAM_DEPOT_ID: "7" },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Steam contentroot is missing:");
    expect(result.stderr).toContain("release-desktop/win-unpacked");
  });

  it("fails dry-run when Alchemy.exe is missing from contentroot", () => {
    mkdirSync(contentRoot, { recursive: true });
    const result = spawnSync("node", ["scripts/steam-upload.mjs"], {
      cwd: ROOT,
      env: { ...process.env, STEAM_UPLOAD_DRY_RUN: "1", STEAM_APP_ID: "42", STEAM_DEPOT_ID: "7" },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing Alchemy.exe");
  });
});
