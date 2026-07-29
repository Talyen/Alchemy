import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  computeContentHash,
  isOutputFresh,
  loadManifest,
  writeManifestIfChanged,
} from "./lib/asset-manifest-cache.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when copy pipeline settings or hash inputs change. */
const SCHEMA_VERSION = 1;

const MUSIC_SETTINGS = { mode: "copy" };

async function main() {
  await mkdir(outputDir, { recursive: true });

  const files = [
    "Menu 1.mp3",
    "Menu 2.mp3",
    "Menu 3.mp3",
    "Menu 4.mp3",
    "Battle 1.mp3",
    "Battle 2.mp3",
    "Battle 3.mp3",
    "Battle 4.mp3",
    "Battle 5.mp3",
    "The Forge Golem.mp3",
    "The Frostwarden.mp3",
    "The Blight Treant.mp3",
    "The Iron Bear.mp3",
  ];

  const previousManifest = await loadManifest(manifestPath);
  /** @type {Record<string, string>} */
  const nextManifest = {};
  const results = [];
  let failed = false;
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file);

    try {
      const expectedHash = await computeContentHash(sourcePath, MUSIC_SETTINGS, SCHEMA_VERSION);
      const isFresh = await isOutputFresh(outputPath, previousManifest[file], expectedHash);
      if (isFresh) {
        results.push(`${file} already up to date`);
        nextManifest[file] = expectedHash;
        continue;
      }
      await copyFile(sourcePath, outputPath);
      nextManifest[file] = expectedHash;
      results.push(`${file} copied`);
    } catch (error) {
      failed = true;
      results.push(`FAILED ${file}: ${error.message}`);
    }
  }

  await writeManifestIfChanged(manifestPath, nextManifest);

  console.log(`Processed ${results.length} music files.`);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Music optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
