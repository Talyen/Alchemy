import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("steam-upload script", () => {
  it("dry-runs without Steam credentials and writes substituted VDFs", () => {
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
    rmSync(join(ROOT, "steam/build"), { recursive: true, force: true });
  });
});
