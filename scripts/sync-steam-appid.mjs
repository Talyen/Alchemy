// Writes steam_appid.txt for local Steamworks dev from steam/platforms.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeTextIfChanged } from "./lib/write-text-if-changed.mjs";

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
  const appId = process.env.STEAM_APP_ID ?? String(config.devAppId ?? 480);
  const outPath = join(root, "steam_appid.txt");

  const wrote = await writeTextIfChanged(outPath, `${appId}\n`);
  console.log(wrote ? `Wrote steam_appid.txt with App ID ${appId}` : `steam_appid.txt already App ID ${appId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
