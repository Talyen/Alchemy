#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { downloadArtifact } = require("@electron/get");
const extract = require("extract-zip");

const electronRoot = path.join(process.cwd(), "node_modules", "electron");
const { version } = require(path.join(electronRoot, "package.json"));
const checksums = require(path.join(electronRoot, "checksums.json"));

function platformPath() {
  switch (process.platform) {
    case "win32":
      return "electron.exe";
    case "linux":
    case "freebsd":
    case "openbsd":
      return "electron";
    case "darwin":
    case "mas":
      return "Electron.app/Contents/MacOS/Electron";
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function canRequireElectron() {
  try {
    require("electron");
    return true;
  } catch {
    return false;
  }
}

async function clearPartialInstall() {
  await fs.promises.rm(path.join(electronRoot, "dist"), { recursive: true, force: true });
  await fs.promises.rm(path.join(electronRoot, "path.txt"), { force: true });
}

async function downloadElectron() {
  const relativePath = platformPath();
  const zipPath = await downloadArtifact({
    version,
    artifactName: "electron",
    platform: process.platform,
    arch: process.arch,
    checksums,
  });

  const distPath = path.join(electronRoot, "dist");
  await fs.promises.mkdir(distPath, { recursive: true });
  await extract(zipPath, { dir: distPath });
  await fs.promises.writeFile(path.join(electronRoot, "path.txt"), relativePath);
}

async function main() {
  if (canRequireElectron()) {
    return;
  }

  await clearPartialInstall();
  await downloadElectron();

  if (!canRequireElectron()) {
    throw new Error("Electron binary is still missing after download");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
