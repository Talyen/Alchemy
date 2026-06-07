import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  electronRoot,
  getExecutablePath,
  isElectronInstalled,
  platformPath,
  resolveElectronExecutablePath,
} from "./electron-path.mjs";

const require = createRequire(import.meta.url);
const { downloadArtifact } = require("@electron/get");
const extract = require("extract-zip");

const { version } = require(path.join(electronRoot, "package.json"));
const checksums = require(path.join(electronRoot, "checksums.json"));

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

  const executablePath = getExecutablePath(relativePath);
  if (process.platform !== "win32") {
    await fs.promises.chmod(executablePath, 0o755);
  }
}

async function main() {
  if (!isElectronInstalled()) {
    await clearPartialInstall();
    await downloadElectron();
  }

  if (!isElectronInstalled()) {
    throw new Error(`Electron binary is still missing at ${resolveElectronExecutablePath()}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
