import { copyFile } from "node:fs/promises";
import path from "node:path";

import { processFreshEntry } from "./lib/asset-manifest-cache.mjs";
import {
  ASSET_SCHEMA_VERSION,
  MANIFEST_BASENAME,
  MUSIC_COPY_CONCURRENCY,
  MUSIC_SETTINGS,
} from "./lib/asset-constants.mjs";
import { MUSIC_FILE_EXTENSIONS, validateMusicRegistry } from "./assets/music-assets.mjs";
import {
  ensureOutputDir,
  readSourceDir,
  resolvePipelinePaths,
  runManifestPipeline,
} from "./lib/asset-pipeline-runner.mjs";
import { runPipelineScript } from "./lib/script-run.mjs";

async function discoverAudioFiles(dir) {
  const entries = await readSourceDir(dir);
  return entries
    .filter((entry) => entry.isFile() && MUSIC_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

const { sourceDir, outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, {
  sourceSubpath: ["Raw Assets", "Music"],
  managedKey: "music",
});

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;

export async function optimizeMusic({ check = false } = {}) {
  const files = await discoverAudioFiles(sourceDir);
  if (files.length === 0) {
    const msg = `No music files found in ${sourceDir}.`;
    console.error(msg);
    return { ok: false, error: msg };
  }
  await validateMusicRegistry(files);

  await ensureOutputDir(outputDir, { check });

  const result = await runManifestPipeline({
    entries: files,
    manifestPath,
    outputDir,
    manifestBasename: MANIFEST_BASENAME,
    label: "music file",
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
    check,
    skipLabel: "music manifest write and orphan sweep",
  });
  if (!result.ok) return result;

  console.log(`Processed ${result.results.length} music files.`);
  return { ok: true };
}

runPipelineScript(import.meta.url, "Music optimization", optimizeMusic);
