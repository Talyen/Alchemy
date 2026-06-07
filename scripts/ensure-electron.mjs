#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  electronRoot,
  isElectronInstalled,
  resolveElectronExecutablePath,
  writeExecutablePathMarker,
} from "./electron-path.mjs";

function runOfficialInstall() {
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  const installScript = path.join(electronRoot, "install.js");
  console.log("Falling back to official Electron install.js...");

  const result = spawnSync(process.execPath, [installScript], {
    cwd: electronRoot,
    env,
    stdio: "inherit",
    timeout: 300_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`electron install.js exited with code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  if (!isElectronInstalled()) {
    console.log("Electron binary missing or incomplete; downloading...");
    const { downloadElectronIfNeeded } = await import("./electron-download.mjs");

    try {
      await downloadElectronIfNeeded();
    } catch (error) {
      console.error(error);
    }
  }

  if (!isElectronInstalled()) {
    runOfficialInstall();
  }

  if (!isElectronInstalled()) {
    throw new Error(`Electron binary is still missing at ${resolveElectronExecutablePath()}`);
  }

  const executablePath = resolveElectronExecutablePath();
  console.log(`Electron ready at ${executablePath}`);
  writeExecutablePathMarker(executablePath);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
