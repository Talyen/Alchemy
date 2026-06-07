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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function clearPartialInstall() {
  await fs.promises.rm(path.join(electronRoot, "dist"), { recursive: true, force: true });
  await fs.promises.rm(path.join(electronRoot, "path.txt"), { force: true });
}

async function locateRelativeExecutable(distPath) {
  const expectedName = path.basename(platformPath());
  const queue = [distPath];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isFile() && entry.name === expectedName) {
        return path.relative(distPath, fullPath).split(path.sep).join(path.posix.sep);
      }
      if (entry.isDirectory()) {
        queue.push(fullPath);
      }
    }
  }

  const entries = [];
  const stack = [distPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const relative = path.relative(distPath, path.join(current, entry.name));
      entries.push(relative);
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }

  throw new Error(
    `Executable ${expectedName} not found under ${distPath}. Extracted entries: ${entries.join(", ") || "(empty)"}`,
  );
}

async function downloadElectronOnce() {
  const distPath = path.join(electronRoot, "dist");
  const zipPath = await downloadArtifact({
    version,
    artifactName: "electron",
    platform: process.platform,
    arch: process.arch,
    checksums,
  });

  await fs.promises.mkdir(distPath, { recursive: true });
  await extract(zipPath, { dir: distPath });

  const relativePath = await locateRelativeExecutable(distPath);
  await fs.promises.writeFile(path.join(electronRoot, "path.txt"), relativePath);

  const executablePath = getExecutablePath(relativePath);
  if (process.platform !== "win32") {
    await fs.promises.chmod(executablePath, 0o755);
  }
}

async function downloadElectronWithRetry() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await clearPartialInstall();
      console.log(`Downloading Electron ${version} (attempt ${attempt}/${maxAttempts})...`);
      await downloadElectronOnce();
      return;
    } catch (error) {
      console.error(error);
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log("Retrying Electron download in 15s...");
      await sleep(15_000);
    }
  }
}

async function main() {
  if (!isElectronInstalled()) {
    await downloadElectronWithRetry();
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
