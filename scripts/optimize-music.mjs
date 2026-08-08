import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isOutputFresh,
  processManifestEntries,
  removeOrphanOutputs,
  resolveSourceHash,
} from "./lib/asset-manifest-cache.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when copy pipeline settings, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 2;

const MUSIC_SETTINGS = { mode: "copy" };

// public/Music is fully managed by this script: every file there must come from
// Raw Assets/Music, so stale outputs can be removed safely. (Unlike public/sounds,
// which intentionally also holds manually-curated files not produced by the pipeline.)
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

async function discoverMusicFiles() {
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

export async function optimizeMusic() {
  await mkdir(outputDir, { recursive: true });

  const files = await discoverMusicFiles();
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
  optimizeMusic()
    .then(({ ok }) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error("Music optimization failed.");
      console.error(error);
      process.exitCode = 1;
    });
}
