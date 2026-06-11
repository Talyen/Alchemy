// Uploads built desktop artifacts to Steam via steamcmd (or dry-run when STEAM_UPLOAD_DRY_RUN=1).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeSteamBuildVdfs } from "./lib/steam-vdf.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.env.STEAM_UPLOAD_DRY_RUN === "1";

if (!dryRun) {
  for (const key of ["STEAM_APP_ID", "STEAM_DEPOT_ID", "STEAM_USERNAME", "STEAM_PASSWORD"]) {
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

const { appPath } = writeSteamBuildVdfs(root, process.env);

if (dryRun) {
  console.log("STEAM_UPLOAD_DRY_RUN=1 — wrote substituted VDFs:");
  console.log(appPath);
  process.exit(0);
}

const result = spawnSync(
  "steamcmd",
  ["+login", process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD, "+run_app_build", appPath, "+quit"],
  { cwd: root, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
