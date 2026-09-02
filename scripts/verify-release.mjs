#!/usr/bin/env node
/** Release gate: tag matches package.json version + packaged desktop integrity. */
import { spawnSync } from "node:child_process";

import { isMainModule } from "./lib/is-main-module.mjs";

function run(label, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync("node", args, { stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
}

function main() {
  const versionCode = run("release tag", ["scripts/verify-release-version.mjs"]);
  if (versionCode !== 0) return versionCode;
  return run("desktop package", ["scripts/verify-desktop-package.mjs"]);
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
