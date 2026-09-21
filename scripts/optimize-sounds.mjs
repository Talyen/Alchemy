import { execFile } from "node:child_process";
import { copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// ffmpeg-static downloads a platform-specific ffmpeg binary so we don't rely
// on system installation. We use it to normalize volume and convert WAVs to OGG.
import ffmpegPath from "ffmpeg-static";

import {
  curatedSoundFiles,
  generatedSoundAssets,
  mp3FallbackName,
  soundEntryOwner,
  validateSoundAssetRegistry,
} from "./assets/sound-assets.mjs";
import {
  commitManifest,
  isOutputFresh,
  processFreshEntry,
  resolveSourceHash,
  withOutputHash,
} from "./assets/asset-manifest-cache.mjs";
import {
  ASSET_SCHEMA_VERSION,
  CURATED_SOUND_SETTINGS,
  LOUDNORM_FILTER,
  MANIFEST_BASENAME,
  MP3_FALLBACK_SETTINGS,
  SOUND_ENTRY_OWNERS,
  SOUND_TRANSFORM_CONCURRENCY,
  VORBIS_QUALITY,
  soundTransformSettings,
} from "./assets/asset-constants.mjs";
import { ensureOutputDir, resolvePipelinePaths, runManifestPipeline } from "./assets/asset-pipeline-runner.mjs";
import { failedMessagesResult } from "./lib/process-helpers.mjs";
import { runPipelineScript } from "./lib/script-run.mjs";
import { mapPool } from "./lib/map-pool.mjs";

const execFileAsync = promisify(execFile);

const { sourceDir, outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, {
  sourceSubpath: ["Raw Assets", "Sound Effects"],
  managedKey: "sounds",
});

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = SOUND_TRANSFORM_CONCURRENCY;

async function optimizeSound({ source, target }, storedEntry, check) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);
  const ext = path.extname(source).toLowerCase();
  const settings = soundTransformSettings(ext);
  const { fresh, entry } = await processFreshEntry(
    sourcePath,
    outputPath,
    settings,
    SCHEMA_VERSION,
    storedEntry,
    () => convertSound(sourcePath, outputPath, settings),
    { check },
  );
  return {
    message: `${target} ${fresh ? "already up to date" : settings.mode === "copy" ? "copied" : "converted"}`,
    entry,
  };
}

async function convertSound(sourcePath, outputPath, settings) {
  if (settings.mode === "copy") {
    await copyFile(sourcePath, outputPath);
    return;
  }

  // Convert WAV (or anything else) to OGG Vorbis with gentle loudness normalization
  // so UI pops aren't deafening next to musical stingers. -q 4 is the sweet spot
  // between quality (~128kbps) and file size for SFX.
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    sourcePath,
    "-af",
    LOUDNORM_FILTER,
    "-c:a",
    "libvorbis",
    "-q:a",
    VORBIS_QUALITY,
    "-vn",
    outputPath,
  ]);
}

export async function optimizeSounds({ check = false } = {}) {
  if (!ffmpegPath) {
    // Report a missing encoder distinctly in check mode too: without ffmpeg a
    // stale MP3 would otherwise masquerade as content staleness.
    const msg = "ffmpeg-static binary not found. Run: npm install";
    console.error(msg);
    return { ok: false, error: msg };
  }

  await ensureOutputDir(outputDir, { check });
  await validateSoundAssetRegistry({ sourceDir });

  const pipeline = await runManifestPipeline({
    entries: generatedSoundAssets,
    manifestPath,
    outputDir,
    manifestBasename: MANIFEST_BASENAME,
    label: "sound file (ogg phase)",
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: (asset, storedEntry) => optimizeSound(asset, storedEntry, check),
    check,
    skipLabel: "sound fallbacks, manifest write, and orphan sweep",
    commit: false,
  });

  // Sounds publishes a complete manifest (OGGs + curated + MP3s) below, so
  // hold publication here and reuse only the phase-1 freshness state.
  if (!pipeline.ok) {
    console.log(`Processed ${pipeline.results.length} sounds.`);
    return pipeline;
  }
  const { previousManifest, nextManifest, results } = pipeline;
  console.log(`Processed ${results.length} sounds.`);
  // Owner tags the OGG source (generated transform vs curated commit). MP3s are
  // always generated artifacts; their owner mirrors their OGG source. MP3 hashes
  // derive from the committed OGG bytes (transitively the raw source).
  const managedOggs = new Set(generatedSoundAssets.map(({ target }) => target));
  const generatedEntries = Object.fromEntries(
    Object.entries(nextManifest).map(([name, entry]) => [name, { ...entry, owner: SOUND_ENTRY_OWNERS.generated }]),
  );
  const { mp3Entries, curatedOggEntries, mp3Failures } = await ensureMp3Fallbacks(previousManifest, managedOggs, check);
  if (mp3Failures.length > 0) {
    return failedMessagesResult(mp3Failures, "sound manifest write and orphan sweep");
  }
  const completeManifest = { ...generatedEntries, ...curatedOggEntries, ...mp3Entries };
  await commitManifest(manifestPath, completeManifest, {
    outputDir,
    check,
    manifestBasename: MANIFEST_BASENAME,
    label: "sound file",
  });
  return { ok: true };
}

async function ensureMp3Fallbacks(previousManifest, managedOggs, check) {
  let files;
  try {
    files = new Set(await readdir(outputDir));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const stale = `Stale prepared asset output: ${outputDir}`;
      return { mp3Entries: {}, curatedOggEntries: {}, mp3Failures: [stale] };
    }
    throw error;
  }
  const oggs = [...managedOggs, ...curatedSoundFiles];
  /** @type {Record<string, import("./assets/asset-manifest-cache.mjs").ManifestEntry>} */
  const mp3Entries = {};
  const curatedOggEntries = {};
  const mp3Failures = [];
  let converted = 0;
  await mapPool(oggs, TRANSFORM_CONCURRENCY, async (ogg) => {
    try {
      const oggPath = path.join(outputDir, ogg);
      const mp3Name = mp3FallbackName(ogg);
      const mp3Path = path.join(outputDir, mp3Name);
      const stored = previousManifest[mp3Name];
      if (!managedOggs.has(ogg) && !files.has(ogg)) throw new Error(`Missing curated sound: ${ogg}`);
      const sourceEntry = await resolveSourceHash(oggPath, MP3_FALLBACK_SETTINGS, SCHEMA_VERSION);
      const owner = soundEntryOwner(ogg, managedOggs);
      if (!managedOggs.has(ogg)) {
        const storedOgg = previousManifest[ogg];
        const oggEntry = await resolveSourceHash(oggPath, CURATED_SOUND_SETTINGS, SCHEMA_VERSION);
        const oggFresh = await isOutputFresh(oggPath, storedOgg, oggEntry.hash);
        if (check && !oggFresh) throw new Error(`Stale curated sound: ${oggPath}`);
        curatedOggEntries[ogg] = {
          ...(oggFresh ? storedOgg : await withOutputHash(oggEntry, oggPath)),
          owner,
        };
      }

      if (!(await isOutputFresh(mp3Path, stored, sourceEntry.hash))) {
        if (check) throw new Error(`Stale prepared asset: ${mp3Path}`);
        await execFileAsync(ffmpegPath, [
          "-y",
          "-i",
          oggPath,
          "-c:a",
          MP3_FALLBACK_SETTINGS.codec,
          "-q:a",
          MP3_FALLBACK_SETTINGS.quality,
          "-vn",
          mp3Path,
        ]);
        converted += 1;
        mp3Entries[mp3Name] = { ...(await withOutputHash(sourceEntry, mp3Path)), owner };
      } else {
        mp3Entries[mp3Name] = { ...stored, owner };
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Missing curated sound:")) throw error;
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${ogg}: ${detail}`);
      mp3Failures.push(`FAILED ${ogg}: ${detail}`);
    }
  });
  if (converted > 0) console.log(`Wrote ${converted} MP3 SFX fallbacks for Safari.`);
  return { mp3Entries, curatedOggEntries, mp3Failures };
}

runPipelineScript(import.meta.url, "Sound optimization", optimizeSounds);
