import { createCleanup } from "@/lib/cleanup";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
const asar = createRequire(import.meta.url)("@electron/asar");
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
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
import { editionPolicy } from "../../game-edition.mjs";

const ROOT = join(import.meta.dirname, "../..");
let fixtureRoot: string;
let contentRoot: string;

beforeEach(() => {
  // The CLI resolves paths from its script location. Copy its dependency closure
  // into a temporary root so package fixtures and cleanup never touch real builds.
  fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "alchemy-steam-upload-fixture-")));
  cpSync(join(ROOT, "scripts"), join(fixtureRoot, "scripts"), { recursive: true });
  for (const file of [
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

async function ensureFakeWinUnpacked(edition: "full" | "demo" = "full") {
  const selected = editionPolicy(edition);
  contentRoot = steamContentRoot(fixtureRoot, { ALCHEMY_EDITION: edition });
  mkdirSync(contentRoot, { recursive: true });
  writeFileSync(join(contentRoot, `${selected.productName}.exe`), "");
  const staging = mkdtempSync(join(tmpdir(), "alchemy-upload-test-"));
  using _scopeCleanup = createCleanup(() => rmSync(staging, { recursive: true, force: true }));

  mkdirSync(join(staging, selected.rendererDirectory));
  mkdirSync(join(contentRoot, "resources"));
  writeFileSync(join(staging, selected.rendererDirectory, "edition.json"), JSON.stringify({ edition }));
  writeFileSync(
    join(staging, "package.json"),
    JSON.stringify({
      gameEdition: edition,
      steamAppId: edition === "demo" ? "43" : "42",
      steamDepotId: edition === "demo" ? "8" : "7",
      fullGameSteamAppId: "42",
    }),
  );
  await asar.createPackage(staging, join(contentRoot, "resources/app.asar"));
}

afterEach(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("steam-upload script", () => {
  it("honors --dry-run with complete credentials without launching SteamCMD", async () => {
    await ensureFakeWinUnpacked();
    const source = `import cp from 'node:child_process';
      import {syncBuiltinESMExports} from 'node:module';
      cp.spawnSync = (command, args) => {
        if (command === 'python3' && args.includes('--prune') && args.includes('--environment'))
          return { status: 0, stdout: '{"removed":false}' };
        throw new Error('unexpected SteamCMD launch');
      };
      syncBuiltinESMExports();
      process.argv = [process.execPath, 'scripts/steam-upload.mjs', '--dry-run'];
      await import('./scripts/steam-upload.mjs');`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: fixtureRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "",
        ALLOW_STEAM_DRY_RUN: "",
        STEAM_APP_ID: "42",
        STEAM_DEPOT_ID: "7",
        STEAM_USERNAME: "build-account",
        STEAM_PASSWORD: "fixture-password",
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Steam upload dry run");
    expect(readFileSync(join(fixtureRoot, "steam/build/app_build.vdf"), "utf8")).toContain('"appid" "42"');
    expect(result.stderr).not.toContain("ALLOW_STEAM_DRY_RUN");
  });

  it.each(["--dry-rnu", "unexpected", "--dry-run=false"])(
    "rejects %s before writing VDFs or launching SteamCMD",
    (argument) => {
      const result = spawnSync(process.execPath, ["scripts/steam-upload.mjs", argument], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/Unknown option|Unexpected Steam upload arguments|does not take a value/u);
      expect(existsSync(join(fixtureRoot, "steam/build"))).toBe(false);
    },
  );

  it.each(["full", "demo"] as const)(
    "honors the release dry-run allowance for %s when upload credentials are missing",
    async (edition) => {
      await ensureFakeWinUnpacked(edition);
      const result = spawnSync(process.execPath, ["scripts/steam-upload.mjs"], {
        cwd: fixtureRoot,
        env: {
          ...process.env,
          ALCHEMY_EDITION: edition,
          STEAM_UPLOAD_DRY_RUN: "",
          ALLOW_STEAM_DRY_RUN: "true",
          STEAM_APP_ID: "42",
          STEAM_DEPOT_ID: "7",
          STEAM_DEMO_APP_ID: "43",
          STEAM_DEMO_DEPOT_ID: "8",
          STEAM_USERNAME: "",
          STEAM_PASSWORD: "",
        },
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("ALLOW_STEAM_DRY_RUN=true");
      expect(result.stdout).toContain("contentroot OK:");
      const appPath = join(fixtureRoot, "steam/build", edition === "demo" ? "demo" : "", "app_build.vdf");
      expect(readFileSync(appPath, "utf8")).toContain(`"appid" "${edition === "demo" ? "43" : "42"}"`);
    },
  );

  it("fails closed without credentials unless dry-run fallback is explicitly allowed", () => {
    const result = spawnSync(process.execPath, ["scripts/steam-upload.mjs"], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "",
        ALLOW_STEAM_DRY_RUN: "",
        STEAM_APP_ID: "42",
        STEAM_DEPOT_ID: "7",
        STEAM_USERNAME: "",
        STEAM_PASSWORD: "",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing required env var(s): STEAM_USERNAME, STEAM_PASSWORD");
    expect(existsSync(join(fixtureRoot, "steam/build"))).toBe(false);
  });

  it("does not use the allowance to hide invalid configured upload targets", () => {
    const result = spawnSync(process.execPath, ["scripts/steam-upload.mjs"], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ALCHEMY_EDITION: "full",
        STEAM_UPLOAD_DRY_RUN: "",
        ALLOW_STEAM_DRY_RUN: "true",
        STEAM_APP_ID: "480",
        STEAM_DEPOT_ID: "7",
        STEAM_USERNAME: "build-account",
        STEAM_PASSWORD: "fixture-password",
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid production Steam App ID");
    expect(existsSync(join(fixtureRoot, "steam/build"))).toBe(false);
  });

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
