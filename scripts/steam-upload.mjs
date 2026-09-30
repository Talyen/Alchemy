import { releaseEdition, assertPackageEdition } from "./lib/release/game-edition.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
// Uploads built desktop artifacts to Steam via steamcmd (or dry-run when STEAM_UPLOAD_DRY_RUN=1).
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { steamContentRoot } from "./lib/release/desktop-artifact.mjs";
import { writeSteamBuildVdfs } from "./lib/release/steam-vdf.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const selected = releaseEdition();
const dryRun = process.env.STEAM_UPLOAD_DRY_RUN === "1";

if (!dryRun) {
  for (const [name, value] of [
    ["App ID", selected.steamAppId],
    ["depot ID", selected.steamDepotId],
  ]) {
    if (
      !/^\d+$/u.test(value ?? "") ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) <= 0 ||
      (name === "App ID" && Number(value) === 480)
    ) {
      throw new Error(`Invalid production Steam ${name}`);
    }
  }
  for (const key of [
    selected.edition === "demo" ? "STEAM_DEMO_APP_ID" : "STEAM_APP_ID",
    selected.edition === "demo" ? "STEAM_DEMO_DEPOT_ID" : "STEAM_DEPOT_ID",
    "STEAM_USERNAME",
    "STEAM_PASSWORD",
  ]) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }
}

if (!existsSync(join(root, "steam/app_build.vdf"))) {
  console.error("Missing steam/app_build.vdf template");
  process.exit(1);
}

const { appPath, contentRoot } = writeSteamBuildVdfs(root, process.env);

function assertSteamContentRoot(directory) {
  if (!existsSync(directory)) {
    console.error(
      `Steam contentroot is missing: ${directory}\n` +
        `Build the Windows unpacked app first (npm run dist:desktop) so ${steamContentRoot(root)} exists.`,
    );
    process.exit(1);
  }

  const executable = join(directory, `${selected.productName}.exe`);
  if (!existsSync(executable)) {
    console.error(`Steam contentroot is missing Alchemy.exe: ${executable}`);
    process.exit(1);
  }

  const entries = readdirSync(directory);
  const forbidden = entries.filter((name) => /Setup.*\.exe$/i.test(name) || name === "builder-debug.yml");
  if (forbidden.length > 0) {
    console.error(
      `Steam contentroot must be the unpacked app only; unexpected files: ${forbidden.join(", ")}\n` +
        `Resolved contentroot: ${directory}`,
    );
    process.exit(1);
  }
}

assertSteamContentRoot(contentRoot);
const archive = join(contentRoot, "resources/app.asar");
const metadata = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
const renderer = JSON.parse(asar.extractFile(archive, `${selected.rendererDirectory}/edition.json`).toString("utf8"));
assertPackageEdition(metadata, renderer);

if (dryRun) {
  console.log("STEAM_UPLOAD_DRY_RUN=1 — wrote substituted VDFs:");
  console.log(appPath);
  console.log(`contentroot OK: ${contentRoot}`);
  process.exit(0);
}

function assertSteamcmdOnPath() {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(probe, ["steamcmd"], { encoding: "utf8", shell: false });
  if ((result.status ?? 1) !== 0) {
    console.error(
      "steamcmd was not found on PATH. Install SteamCMD (release.yml uses CyberAndrii/setup-steamcmd) before uploading.",
    );
    process.exit(1);
  }
}

assertSteamcmdOnPath();

const result = spawnSync(
  "steamcmd",
  ["+login", process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD, "+run_app_build", appPath, "+quit"],
  { cwd: root, stdio: "inherit", shell: false },
);

process.exit(result.status ?? 1);
