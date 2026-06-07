#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  electronRoot,
  isElectronInstalled,
  platformPath,
  projectRoot,
  resolveElectronExecutablePath,
  writeExecutablePathMarker,
} from "./electron-path.mjs";

function sleepSync(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    // busy-wait so we can poll install.js without top-level await
  }
}

function listDistEntries(distPath) {
  const entries = [];
  const stack = [{ current: distPath, prefix: "" }];

  while (stack.length > 0) {
    const { current, prefix } = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      entries.push(relative);
      if (entry.isDirectory()) {
        stack.push({ current: path.join(current, entry.name), prefix: relative });
      }
    }
  }

  return entries;
}

function locateRelativeExecutableSync(distPath) {
  const expectedName = path.basename(platformPath());
  const stack = [distPath];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isFile() && entry.name === expectedName) {
        return path.relative(distPath, fullPath).split(path.sep).join(path.posix.sep);
      }
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }

  return null;
}

function normalizeInstallLayout() {
  const distPath = path.join(electronRoot, "dist");
  const relativePath = locateRelativeExecutableSync(distPath);
  if (!relativePath) {
    return false;
  }

  fs.writeFileSync(path.join(electronRoot, "path.txt"), relativePath);
  const executablePath = path.join(distPath, relativePath);
  if (process.platform !== "win32") {
    fs.chmodSync(executablePath, 0o755);
  }

  return true;
}

function runOfficialInstall() {
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  const result = spawnSync(process.execPath, [path.join(electronRoot, "install.js")], {
    cwd: projectRoot,
    env,
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

function waitForInstallCompletion() {
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    normalizeInstallLayout();
    if (isElectronInstalled()) {
      return;
    }
    sleepSync(1000);
  }

  throw new Error("Timed out waiting for Electron install to finish");
}

function main() {
  if (!isElectronInstalled()) {
    console.log("Electron binary missing or incomplete; downloading...");
    runOfficialInstall();
    waitForInstallCompletion();
  }

  if (!normalizeInstallLayout() || !isElectronInstalled()) {
    const distPath = path.join(electronRoot, "dist");
    const entries = fs.existsSync(distPath) ? listDistEntries(distPath) : [];
    throw new Error(
      `Electron binary is still missing at ${resolveElectronExecutablePath()}. Extracted entries: ${entries.join(", ") || "(empty)"}`,
    );
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
