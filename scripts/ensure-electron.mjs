#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { downloadArtifact } = require("@electron/get");
const extract = require("extract-zip");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronRoot = path.join(projectRoot, "node_modules", "electron");
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

function getExecutablePath(relativePath = platformPath()) {
  const overrideDist = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  if (overrideDist) {
    return path.join(overrideDist, relativePath);
  }

  return path.join(electronRoot, "dist", relativePath);
}

function isElectronInstalled() {
  const relativePath = platformPath();
  const pathFile = path.join(electronRoot, "path.txt");

  if (fs.existsSync(pathFile)) {
    const fromFile = fs.readFileSync(pathFile, "utf8").trim();
    if (fromFile && fs.existsSync(getExecutablePath(fromFile))) {
      return true;
    }
  }

  return fs.existsSync(getExecutablePath(relativePath));
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
  if (isElectronInstalled()) {
    return;
  }

  await clearPartialInstall();
  await downloadElectron();

  if (!isElectronInstalled()) {
    throw new Error("Electron binary is still missing after download");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
