import { execFile } from "node:child_process";
import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// ffmpeg-static downloads a platform-specific ffmpeg binary so we don't rely
// on system installation. We use it to normalize volume and convert WAVs to OGG.
import ffmpegPath from "ffmpeg-static";

import { curatedSoundFiles, generatedSoundAssets, validateSoundAssetRegistry } from "./assets/sound-assets.mjs";
import {
  commitManifest,
  isOutputFresh,
  processFreshEntry,
  processManifestEntries,
  resolveSourceHash,
  withOutputHash,
} from "./lib/asset-manifest-cache.mjs";
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
} from "./lib/asset-constants.mjs";
import { runPipelineScript } from "./lib/audio-optimizer.mjs";
import { failedOptimizeResult, targetErrorHandler } from "./lib/process-helpers.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { mapPool } from "./lib/map-pool.mjs";
import { resolveRootDir } from "./lib/sync-generated-helpers.mjs";

const execFileAsync = promisify(execFile);

const rootDir = resolveRootDir(import.meta.url);
const sourceDir = path.join(rootDir, "Raw Assets", "Sound Effects");
const outputDir = path.join(rootDir, "public", "sounds");
const manifestPath = path.join(outputDir, MANIFEST_BASENAME);

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = SOUND_TRANSFORM_CONCURRENCY;

async function optimizeSound({ source, target }, storedEntry) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);
  const ext = path.extname(source).toLowerCase();
  const settings = soundTransformSettings(ext);
  const { fresh, entry } = await processFreshEntry(sourcePath, outputPath, settings, SCHEMA_VERSION, storedEntry, () =>
    convertSound(sourcePath, outputPath, settings),
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

export async function optimizeSounds() {
  if (!ffmpegPath) {
    const msg = "ffmpeg-static binary not found. Run: npm install";
    console.error(msg);
    return { ok: false, error: msg };
  }

  await mkdir(outputDir, { recursive: true });
  await validateSoundAssetRegistry({ sourceDir });

  const { previousManifest, nextManifest, results, failed } = await processManifestEntries({
    entries: generatedSoundAssets,
    manifestPath,
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: optimizeSound,
    handleError: targetErrorHandler,
  });

  console.log(`Processed ${results.length} sounds.`);
  if (failed) {
    return failedOptimizeResult(results, "sound fallbacks, manifest write, and orphan sweep");
  }
  // Owner tags the OGG source (generated transform vs curated commit). MP3s are
  // always generated artifacts; their owner mirrors their OGG source. MP3 hashes
  // derive from the committed OGG bytes (transitively the raw source).
  const managedOggs = new Set(generatedSoundAssets.map(({ target }) => target));
  const generatedEntries = Object.fromEntries(
    Object.entries(nextManifest).map(([name, entry]) => [name, { ...entry, owner: SOUND_ENTRY_OWNERS.generated }]),
  );
  const { mp3Entries, curatedOggEntries, mp3Failures } = await ensureMp3Fallbacks(previousManifest, managedOggs);
  if (mp3Failures.length > 0) {
    console.warn("Skipping sound manifest write and orphan sweep because MP3 fallback conversion failed.");
    return { ok: false, error: mp3Failures.join(" ") };
  }
  const completeManifest = { ...generatedEntries, ...curatedOggEntries, ...mp3Entries };
  await commitManifest(manifestPath, completeManifest, {
    outputDir,
    manifestBasename: MANIFEST_BASENAME,
    label: "sound file",
  });
  return { ok: true };
}

async function ensureMp3Fallbacks(previousManifest, managedOggs) {
  const files = new Set(await readdir(outputDir));
  const oggs = [...managedOggs, ...curatedSoundFiles];
  /** @type {Record<string, import("./lib/asset-manifest-cache.mjs").ManifestEntry>} */
  const mp3Entries = {};
  const curatedOggEntries = {};
  const mp3Failures = [];
  let converted = 0;
  await mapPool(oggs, TRANSFORM_CONCURRENCY, async (ogg) => {
    try {
      const oggPath = path.join(outputDir, ogg);
      const mp3Name = ogg.replace(/\.ogg$/i, ".mp3");
      const mp3Path = path.join(outputDir, mp3Name);
      const stored = previousManifest[mp3Name];
      if (!managedOggs.has(ogg) && !files.has(ogg)) throw new Error(`Missing curated sound: ${ogg}`);
      const sourceEntry = await resolveSourceHash(oggPath, MP3_FALLBACK_SETTINGS, SCHEMA_VERSION);
      const owner = managedOggs.has(ogg) ? SOUND_ENTRY_OWNERS.generated : SOUND_ENTRY_OWNERS.curated;
      if (!managedOggs.has(ogg)) {
        const storedOgg = previousManifest[ogg];
        const oggEntry = await resolveSourceHash(oggPath, CURATED_SOUND_SETTINGS, SCHEMA_VERSION);
        const oggFresh = await isOutputFresh(oggPath, storedOgg, oggEntry.hash);
        curatedOggEntries[ogg] = {
          ...(oggFresh ? storedOgg : await withOutputHash(oggEntry, oggPath)),
          owner: SOUND_ENTRY_OWNERS.curated,
        };
      }

      if (!(await isOutputFresh(mp3Path, stored, sourceEntry.hash))) {
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

if (isMainModule(import.meta.url)) {
  runPipelineScript("Sound optimization", optimizeSounds);
}
