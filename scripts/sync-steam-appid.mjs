import { releaseEdition } from "./lib/release/game-edition.mjs";
// Writes steam_appid.txt for local Steamworks dev from steam/platforms.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { writeTextIfChanged } from "./lib/write-text-if-changed.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function syncSteamAppId({ rootDir = root } = {}) {
  const config = JSON.parse(readFileSync(join(rootDir, "steam/platforms.json"), "utf8"));
  const appId = releaseEdition().steamAppId ?? String(config.devAppId ?? 480);
  const outPath = join(rootDir, "steam_appid.txt");

  const wrote = await writeTextIfChanged(outPath, `${appId}\n`);
  console.log(wrote ? `Wrote steam_appid.txt with App ID ${appId}` : `steam_appid.txt already App ID ${appId}`);
  return wrote;
}

defineScript(import.meta.url, () => {
  const { flags, rest } = parseKnownFlags(process.argv.slice(2), { help: { short: "h" } });
  if (rest.length) throw new UsageError(`Unexpected App ID synchronization arguments: ${rest.join(", ")}`);
  if (flags.has("help")) {
    console.log("Usage: node scripts/sync-steam-appid.mjs (write the selected local Steam App ID)");
    return;
  }
  return syncSteamAppId();
});
