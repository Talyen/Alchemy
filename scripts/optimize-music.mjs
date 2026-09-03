import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

import {
  isOutputFresh,
  processManifestEntries,
  removeOrphanOutputs,
  resolveSourceHash,
  withOutputHash,
} from "./lib/asset-manifest-cache.mjs";
import { ASSET_SCHEMA_VERSION, MANIFEST_BASENAME, MUSIC_SETTINGS } from "./lib/asset-constants.mjs";
import { discoverAudioFiles, runAudioScript } from "./lib/audio-optimizer.mjs";
import { formatProcessError } from "./lib/process-helpers.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { resolveRootDir } from "./lib/sync-generated-helpers.mjs";

const rootDir = resolveRootDir(import.meta.url);
const sourceDir = path.join(rootDir, "Raw Assets", "Music");
const outputDir = path.join(rootDir, "public", "Music");
const manifestPath = path.join(outputDir, MANIFEST_BASENAME);

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;

export async function optimizeMusic() {
  await mkdir(outputDir, { recursive: true });

  const files = await discoverAudioFiles(sourceDir);
  if (files.length === 0) {
    const msg = `No music files found in ${sourceDir}.`;
    console.error(msg);
    return { ok: false, error: msg };
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
      manifestBasename: MANIFEST_BASENAME,
      label: "music file",
    });
    if (removed > 0) {
      console.log(`Removed ${removed} orphan music files.`);
    }
  }

  console.log(`Processed ${results.length} music files.`);
  return { ok: !failed, error: failed ? "One or more music files failed" : undefined };
}

if (isMainModule(import.meta.url)) {
  runAudioScript("Music optimization", optimizeMusic);
}
