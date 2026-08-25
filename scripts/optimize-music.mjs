import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isOutputFresh,
  processManifestEntries,
  removeOrphanOutputs,
  resolveSourceHash,
  withOutputHash,
} from "./lib/asset-manifest-cache.mjs";
import { discoverAudioFiles, formatProcessError, runAudioScript } from "./lib/audio-optimizer.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when copy pipeline settings, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 3;

const MUSIC_SETTINGS = { mode: "copy" };

export async function optimizeMusic() {
  await mkdir(outputDir, { recursive: true });

  const files = await discoverAudioFiles(sourceDir);
  if (files.length === 0) {
    console.error(`No music files found in ${sourceDir}.`);
    return { ok: false };
  }

  const { results, failed } = await processManifestEntries({
    entries: files,
    manifestPath,
    processEntry: async (file, storedEntry) => {
      const sourcePath = path.join(sourceDir, file);
      const outputPath = path.join(outputDir, file);

      const sourceEntry = await resolveSourceHash(sourcePath, MUSIC_SETTINGS, SCHEMA_VERSION, storedEntry);
      const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
      if (isFresh) {
        return { message: `${file} already up to date`, entry: storedEntry };
      }
      await copyFile(sourcePath, outputPath);
      return { message: `${file} copied`, entry: await withOutputHash(sourceEntry, outputPath) };
    },
    handleError: formatProcessError,
  });

  if (!failed) {
    const removed = await removeOrphanOutputs(outputDir, new Set(files), {
      manifestBasename: ".asset-hashes.json",
      label: "music file",
    });
    if (removed > 0) {
      console.log(`Removed ${removed} orphan music files.`);
    }
  }

  console.log(`Processed ${results.length} music files.`);
  return { ok: !failed };
}

if (isMainModule(import.meta.url)) {
  runAudioScript("Music optimization", optimizeMusic);
}
