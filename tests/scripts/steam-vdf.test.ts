import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSteamContentRoot, substituteSteamVdf, writeSteamBuildVdfs } from "../../scripts/lib/steam-vdf.mjs";

const workspaceRoot = join(import.meta.dirname, "../..");

describe("steam VDF substitution", () => {
  it("replaces template placeholders", () => {
    const result = substituteSteamVdf(
      '"appid" "${STEAM_APP_ID}"\n"depot" "${STEAM_DEPOT_ID}"\n"path" "${BUILD_OUTPUT}"\n"content" "${CONTENT_ROOT}"',
      {
        STEAM_APP_ID: "123",
        STEAM_DEPOT_ID: "456",
        BUILD_OUTPUT: "C:/out",
        CONTENT_ROOT: "C:/out/win-unpacked",
      },
    );
    expect(result).toContain('"appid" "123"');
    expect(result).toContain('"depot" "456"');
    expect(result).toContain('"path" "C:/out"');
    expect(result).toContain('"content" "C:/out/win-unpacked"');
    expect(result).not.toContain("${");
  });

  it("writes substituted app and depot VDF files for steamcmd", () => {
    const { appPath, depotPath, contentRoot } = writeSteamBuildVdfs(workspaceRoot, {
      STEAM_APP_ID: "999",
      STEAM_DEPOT_ID: "111",
    });

    const appVdf = readFileSync(appPath, "utf8");
    const depotVdf = readFileSync(depotPath, "utf8");
    expect(appVdf).toContain('"appid" "999"');
    expect(depotVdf).toContain('"DepotID" "111"');
    expect(appVdf).not.toContain("${STEAM_APP_ID}");
    expect(appVdf).toContain(`"contentroot" "${contentRoot.replaceAll("\\", "/")}"`);
    expect(appVdf).toContain('"setlive" ""');
    expect(contentRoot).toBe(resolveSteamContentRoot(workspaceRoot));
    expect(contentRoot.replaceAll("\\", "/")).toMatch(/release-desktop\/win-unpacked$/);

    rmSync(join(workspaceRoot, "steam/build"), { recursive: true, force: true });
  });

  it("keeps buildoutput on release-desktop while contentroot is win-unpacked", () => {
    const { appPath } = writeSteamBuildVdfs(workspaceRoot, {
      STEAM_APP_ID: "1",
      STEAM_DEPOT_ID: "2",
    });
    const appVdf = readFileSync(appPath, "utf8");
    expect(appVdf).toMatch(/"buildoutput" ".*\/release-desktop"/);
    expect(appVdf).toMatch(/"contentroot" ".*\/release-desktop\/win-unpacked"/);
    expect(appVdf).not.toContain("builder-debug.yml");
    rmSync(join(workspaceRoot, "steam/build"), { recursive: true, force: true });
  });
});
