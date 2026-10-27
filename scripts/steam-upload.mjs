import { releaseEdition, assertPackageEdition } from "./lib/release/game-edition.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
// Uploads built desktop artifacts to Steam via steamcmd (or dry-run when STEAM_UPLOAD_DRY_RUN=1).
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { steamContentRoot } from "./lib/release/desktop-artifact.mjs";
import { writeSteamBuildVdfs } from "./lib/release/steam-vdf.mjs";
import { runCommand, runStreamCommand } from "./lib/run-command.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { protectPackageAttempts } from "./lib/build-retention.mjs";

function main(argv = process.argv.slice(2)) {
  const { flags, rest } = parseKnownFlags(argv, { "dry-run": {}, help: { short: "h" } });
  if (rest.length) throw new UsageError(`Unexpected Steam upload arguments: ${rest.join(", ")}`);
  if (flags.has("help")) {
    console.log(
      "Usage: node scripts/steam-upload.mjs [--dry-run]\nValidate the selected package and write Steam VDFs. --dry-run (or STEAM_UPLOAD_DRY_RUN=1) prevents uploading, including when credentials are configured.",
    );
    return 0;
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const selected = releaseEdition();
  const requiredKeys = [
    selected.edition === "demo" ? "STEAM_DEMO_APP_ID" : "STEAM_APP_ID",
    selected.edition === "demo" ? "STEAM_DEMO_DEPOT_ID" : "STEAM_DEPOT_ID",
    "STEAM_USERNAME",
    "STEAM_PASSWORD",
  ];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]?.trim());
  const dryRun =
    flags.has("dry-run") ||
    process.env.STEAM_UPLOAD_DRY_RUN === "1" ||
    (process.env.ALLOW_STEAM_DRY_RUN === "true" && missingKeys.length > 0);

  if (dryRun && !flags.has("dry-run") && process.env.STEAM_UPLOAD_DRY_RUN !== "1") {
    console.warn(`Steam upload disabled by ALLOW_STEAM_DRY_RUN=true; missing ${missingKeys.join(", ")}.`);
  }

  if (!dryRun) {
    if (missingKeys.length > 0) {
      console.error(`Missing required env var(s): ${missingKeys.join(", ")}`);
      return 1;
    }
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
  }

  if (!existsSync(join(root, "steam/app_build.vdf"))) {
    console.error("Missing steam/app_build.vdf template");
    return 1;
  }

  const { appPath, contentRoot } = writeSteamBuildVdfs(root, process.env);

  function assertSteamContentRoot(directory) {
    if (!existsSync(directory)) {
      throw new Error(
        `Steam contentroot is missing: ${directory}\n` +
          `Build the Windows unpacked app first (npm run dist:desktop) so ${steamContentRoot(root)} exists.`,
      );
    }

    const executable = join(directory, `${selected.productName}.exe`);
    if (!existsSync(executable)) {
      throw new Error(`Steam contentroot is missing ${selected.productName}.exe: ${executable}`);
    }

    const entries = readdirSync(directory);
    const forbidden = entries.filter((name) => /Setup.*\.exe$/i.test(name) || name === "builder-debug.yml");
    if (forbidden.length > 0) {
      throw new Error(
        `Steam contentroot must be the unpacked app only; unexpected files: ${forbidden.join(", ")}\n` +
          `Resolved contentroot: ${directory}`,
      );
    }
  }

  assertSteamContentRoot(contentRoot);
  const archive = join(contentRoot, "resources/app.asar");
  const metadata = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
  const renderer = JSON.parse(asar.extractFile(archive, `${selected.rendererDirectory}/edition.json`).toString("utf8"));
  assertPackageEdition(metadata, renderer);

  if (dryRun) {
    console.log("Steam upload dry run — wrote substituted VDFs:");
    console.log(appPath);
    console.log(`contentroot OK: ${contentRoot}`);
    return 0;
  }

  // Once upload is attempted, retain the package even if the remote outcome is uncertain.
  protectPackageAttempts(root, selected.packageDirectory);

  function assertSteamcmdOnPath() {
    const probe = process.platform === "win32" ? "where.exe" : "which";
    const result = runCommand(probe, ["steamcmd"]);
    if ((result.status ?? 1) !== 0) {
      throw new Error(
        "steamcmd was not found on PATH. Install SteamCMD (release.yml uses CyberAndrii/setup-steamcmd) before uploading.",
      );
    }
  }

  assertSteamcmdOnPath();

  const result = runStreamCommand(
    "steamcmd",
    ["+login", process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD, "+run_app_build", appPath, "+quit"],
    { cwd: root },
  );

  if (result.error) throw result.error;
  return result.status ?? 1;
}

defineScript(import.meta.url, () => main(), {
  artifacts: !process.argv.includes("--help") && !process.argv.includes("-h"),
});
