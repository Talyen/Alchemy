// Writes steam_appid.txt for local Steamworks dev from steam/platforms.json.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
const appId = process.env.STEAM_APP_ID ?? String(config.devAppId ?? 480);
const outPath = join(root, "steam_appid.txt");
writeFileSync(outPath, `${appId}\n`, "utf8");
console.log(`Wrote steam_appid.txt with App ID ${appId}`);
