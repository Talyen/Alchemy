#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  electronRoot,
  isElectronInstalled,
  projectRoot,
  resolveElectronExecutablePath,
  writeExecutablePathMarker,
} from "./electron-path.mjs";

function envWithoutSkip() {
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  return env;
}

function runNpmRebuildElectronSync() {
  console.log("Running npm rebuild electron...");
  const result = spawnSync("npm", ["rebuild", "electron"], {
    cwd: projectRoot,
    env: envWithoutSkip(),
    stdio: "inherit",
    timeout: 600_000,
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm rebuild electron exited with code ${result.status ?? "unknown"}`);
  }
}

function runScriptSync(scriptName, { cwd = projectRoot, timeout = 600_000 } = {}) {
  const scriptPath = path.join(projectRoot, "scripts", scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: envWithoutSkip(),
    stdio: "inherit",
    timeout,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with code ${result.status ?? "unknown"}`);
  }
}

function runOfficialInstallSync() {
  console.log("Running official Electron install.js...");
  const result = spawnSync(process.execPath, [path.join(electronRoot, "install.js")], {
    cwd: electronRoot,
    env: envWithoutSkip(),
    stdio: "inherit",
    timeout: 600_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`electron install.js exited with code ${result.status ?? "unknown"}`);
  }
}

function finalize() {
  const executablePath = resolveElectronExecutablePath();
  console.log(`Electron ready at ${executablePath}`);
  writeExecutablePathMarker(executablePath);
}

function main() {
  if (isElectronInstalled()) {
    finalize();
    return;
  }

  console.log("Electron binary missing or incomplete; downloading...");

  for (const step of [
    () => runNpmRebuildElectronSync(),
    () => runOfficialInstallSync(),
    () => runScriptSync("electron-download.mjs"),
  ]) {
    if (isElectronInstalled()) {
      break;
    }

    try {
      step();
    } catch (error) {
      console.error(error);
    }
  }

  if (!isElectronInstalled()) {
    throw new Error(`Electron binary is still missing at ${resolveElectronExecutablePath()}`);
  }

  finalize();
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
