#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  isElectronInstalled,
  projectRoot,
  resolveElectronExecutablePath,
  writeExecutablePathMarker,
} from "./electron-path.mjs";

function runDownloadChild() {
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts", "electron-download.mjs")], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    timeout: 1_200_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`electron-download.mjs exited with code ${result.status ?? "unknown"}`);
  }
}

function main() {
  if (!isElectronInstalled()) {
    console.log("Electron binary missing or incomplete; downloading...");
    runDownloadChild();
  }

  if (!isElectronInstalled()) {
    throw new Error(`Electron binary is still missing at ${resolveElectronExecutablePath()}`);
  }

  const executablePath = resolveElectronExecutablePath();
  console.log(`Electron ready at ${executablePath}`);
  writeExecutablePathMarker(executablePath);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
