import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isOutputFresh, processManifestEntries, resolveSourceHash } from "./lib/asset-manifest-cache.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when copy pipeline settings, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 2;

const MUSIC_SETTINGS = { mode: "copy" };

export async function optimizeMusic() {
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

  const { results, failed } = await processManifestEntries({
    entries: files,
    manifestPath,
    processEntry: async (file, storedEntry) => {
      const sourcePath = path.join(sourceDir, file);
      const outputPath = path.join(outputDir, file);

      const sourceEntry = await resolveSourceHash(sourcePath, MUSIC_SETTINGS, SCHEMA_VERSION, storedEntry);
      const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
      if (isFresh) {
        return { message: `${file} already up to date`, entry: sourceEntry };
      }
      await copyFile(sourcePath, outputPath);
      return { message: `${file} copied`, entry: sourceEntry };
    },
    handleError: (file, error) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${file}: ${detail}`);
      return { message: `FAILED ${file}: ${detail}`, entry: null };
    },
  });

  console.log(`Processed ${results.length} music files.`);
  if (failed) {
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) {
  optimizeMusic().catch((error) => {
    console.error("Music optimization failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
