import { createRequire } from "node:module";
import { tmpdir } from "node:os";
const asar = createRequire(import.meta.url)("@electron/asar");
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { steamContentRoot } from "../../scripts/lib/release/desktop-artifact.mjs";

const ROOT = join(import.meta.dirname, "../..");
let fixtureRoot: string;
let contentRoot: string;

beforeEach(() => {
  // The CLI resolves paths from its script location. Copy its dependency closure
  // into a temporary root so package fixtures and cleanup never touch real builds.
  fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "alchemy-steam-upload-fixture-")));
  for (const file of [
    "scripts/steam-upload.mjs",
    "scripts/lib/release/game-edition.mjs",
    "scripts/lib/release/desktop-artifact.mjs",
    "scripts/lib/release/steam-vdf.mjs",
    "desktop/package-layout.cjs",
    "game-edition.mjs",
    "steam/app_build.vdf",
    "steam/depot_build.vdf",
  ]) {
    const destination = join(fixtureRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(ROOT, file), destination);
  }
  symlinkSync(
    join(ROOT, "node_modules"),
    join(fixtureRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  contentRoot = steamContentRoot(fixtureRoot, { ALCHEMY_EDITION: "full" });
});

async function ensureFakeWinUnpacked() {
  mkdirSync(contentRoot, { recursive: true });
  writeFileSync(join(contentRoot, "Alchemy.exe"), "");
  const staging = mkdtempSync(join(tmpdir(), "alchemy-upload-test-"));
  try {
    mkdirSync(join(staging, "dist"));
    mkdirSync(join(contentRoot, "resources"));
    writeFileSync(join(staging, "dist/edition.json"), JSON.stringify({ edition: "full" }));
    writeFileSync(
      join(staging, "package.json"),
      JSON.stringify({ gameEdition: "full", steamAppId: "42", steamDepotId: "7", fullGameSteamAppId: "42" }),
    );
    await asar.createPackage(staging, join(contentRoot, "resources/app.asar"));
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

afterEach(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("steam-upload script", () => {
  it("dry-runs without Steam credentials and writes substituted VDFs when contentroot is valid", async () => {
    await ensureFakeWinUnpacked();
    const result = spawnSync("node", ["scripts/steam-upload.mjs"], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "1",
        STEAM_APP_ID: "42",
        STEAM_DEPOT_ID: "7",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const appPath = join(fixtureRoot, "steam/build/app_build.vdf");
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
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "1",
        STEAM_APP_ID: "42",
        STEAM_DEPOT_ID: "7",
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Steam contentroot is missing:");
    expect(result.stderr).toContain("release-desktop/win-unpacked");
  });

  it("fails dry-run when Alchemy.exe is missing from contentroot", () => {
    mkdirSync(contentRoot, { recursive: true });
    const result = spawnSync("node", ["scripts/steam-upload.mjs"], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "1",
        STEAM_APP_ID: "42",
        STEAM_DEPOT_ID: "7",
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing Alchemy.exe");
  });
});
