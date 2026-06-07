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

function isInstalled() {
  const relativePath = platformPath();
  try {
    if (fs.readFileSync(path.join(electronRoot, "dist", "version"), "utf8").replace(/^v/, "") !== version) {
      return false;
    }
    if (fs.readFileSync(path.join(electronRoot, "path.txt"), "utf8") !== relativePath) {
      return false;
    }
  } catch {
    return false;
  }

  return fs.existsSync(path.join(electronRoot, "dist", relativePath));
}

async function main() {
  if (isInstalled()) {
    return;
  }

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

  if (!isInstalled()) {
    throw new Error("Electron binary is still missing after download");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
