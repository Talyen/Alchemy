import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  electronRoot,
  getExecutablePath,
  isElectronInstalled,
  MIN_BINARY_BYTES,
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

async function listDistEntries(distPath) {
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

  return entries;
}

async function locateRelativeExecutable(distPath) {
  const expectedName = path.basename(platformPath());
  const candidates = [];
  const queue = [distPath];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isFile() && entry.name === expectedName) {
        const stat = await fs.promises.stat(fullPath);
        if (stat.size > MIN_BINARY_BYTES) {
          candidates.push({ fullPath, size: stat.size });
        }
      } else if (entry.isDirectory()) {
        queue.push(fullPath);
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.size - a.size);
    return path.relative(distPath, candidates[0].fullPath).split(path.sep).join(path.posix.sep);
  }

  const entries = await listDistEntries(distPath);
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

  const stat = await fs.promises.stat(executablePath);
  console.log(`Electron extracted to ${executablePath} (${stat.size} bytes)`);
}

async function downloadElectronWithRetry() {
  const maxAttempts = 2;
  const keepAlive = setInterval(() => {}, 60_000);

  try {
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
        console.log("Retrying Electron download in 5s...");
        await sleep(5_000);
      }
    }
  } finally {
    clearInterval(keepAlive);
  }
}

export async function downloadElectronIfNeeded() {
  if (!isElectronInstalled()) {
    await downloadElectronWithRetry();
  }

  if (!isElectronInstalled()) {
    throw new Error(`Electron binary is still missing at ${resolveElectronExecutablePath()}`);
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  downloadElectronIfNeeded()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
