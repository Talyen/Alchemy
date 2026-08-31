import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { substituteSteamVdf, writeSteamBuildVdfs } from "../../scripts/lib/steam-vdf.mjs";
import { steamContentRoot } from "../../scripts/lib/desktop-artifact.mjs";

const sourceRoot = join(import.meta.dirname, "../..");
const temporaryRoots: string[] = [];

function createWorkspace() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "alchemy-steam-vdf-"));
  const steamRoot = join(workspaceRoot, "steam");
  mkdirSync(steamRoot);
  copyFileSync(join(sourceRoot, "steam", "app_build.vdf"), join(steamRoot, "app_build.vdf"));
  copyFileSync(join(sourceRoot, "steam", "depot_build.vdf"), join(steamRoot, "depot_build.vdf"));
  temporaryRoots.push(workspaceRoot);
  return workspaceRoot;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

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
    const workspaceRoot = createWorkspace();
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
    expect(contentRoot).toBe(steamContentRoot(workspaceRoot));
    expect(contentRoot.replaceAll("\\", "/")).toMatch(/release-desktop\/win-unpacked$/);
  });

  it("keeps buildoutput on release-desktop while contentroot is win-unpacked", () => {
    const workspaceRoot = createWorkspace();
    const { appPath } = writeSteamBuildVdfs(workspaceRoot, {
      STEAM_APP_ID: "1",
      STEAM_DEPOT_ID: "2",
    });
    const appVdf = readFileSync(appPath, "utf8");
    expect(appVdf).toMatch(/"buildoutput" ".*\/release-desktop"/);
    expect(appVdf).toMatch(/"contentroot" ".*\/release-desktop\/win-unpacked"/);
    expect(appVdf).not.toContain("builder-debug.yml");
  });
});
