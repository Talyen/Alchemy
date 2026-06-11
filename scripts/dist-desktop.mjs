// Runs electron-builder for each target declared in steam/platforms.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
const targets = config.targets ?? ["win"];

const builderArgs = ["cross-env", "NODE_OPTIONS=--no-deprecation", "electron-builder"];
for (const target of targets) {
  if (target === "win") builderArgs.push("--win");
  if (target === "linux") builderArgs.push("--linux");
  if (target === "mac") builderArgs.push("--mac");
}

if (process.env.CI_RELEASE === "true") {
  builderArgs.push("-c.win.signAndEditExecutable=true");
}

const result = spawnSync("npx", builderArgs, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
