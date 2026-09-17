import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";

import { commitManifest, processFreshEntry, processManifestEntries } from "./lib/asset-manifest-cache.mjs";
import {
  ASSET_SCHEMA_VERSION,
  MANIFEST_BASENAME,
  MUSIC_COPY_CONCURRENCY,
  MUSIC_SETTINGS,
} from "./lib/asset-constants.mjs";
import { failedOptimizeResult, targetErrorHandler } from "./lib/process-helpers.mjs";
import { runPipelineScript } from "./lib/script-run.mjs";
import { resolveRootDir } from "./lib/sync-generated-helpers.mjs";

const MUSIC_FILE_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

async function discoverAudioFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && MUSIC_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

const rootDir = resolveRootDir(import.meta.url);
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, MANIFEST_BASENAME);

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;

export async function optimizeMusic({ check = false } = {}) {
  const files = await discoverAudioFiles(sourceDir);
  if (files.length === 0) {
    const msg = `No music files found in ${sourceDir}.`;
    console.error(msg);
    return { ok: false, error: msg };
  }

  if (!check) await mkdir(outputDir, { recursive: true });

  const { results, nextManifest, failed } = await processManifestEntries({
    entries: files,
    manifestPath,
    concurrency: MUSIC_COPY_CONCURRENCY,
    processEntry: async (file, storedEntry) => {
      const sourcePath = path.join(sourceDir, file);
      const outputPath = path.join(outputDir, file);

      const { fresh, entry } = await processFreshEntry(
        sourcePath,
        outputPath,
        MUSIC_SETTINGS,
        SCHEMA_VERSION,
        storedEntry,
        () => copyFile(sourcePath, outputPath),
        { check },
      );
      return { message: `${file} ${fresh ? "already up to date" : "copied"}`, entry };
    },
    handleError: targetErrorHandler,
  });

  if (failed) {
    return failedOptimizeResult(results, "music manifest write and orphan sweep");
  }

  await commitManifest(manifestPath, nextManifest, {
    outputDir,
    check,
    manifestBasename: MANIFEST_BASENAME,
    label: "music file",
  });

  console.log(`Processed ${results.length} music files.`);
  return { ok: true };
}

runPipelineScript(import.meta.url, "Music optimization", optimizeMusic);
