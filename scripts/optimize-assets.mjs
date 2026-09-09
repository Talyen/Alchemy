import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { staticAssets, validateAssetRegistry } from "./assets/asset-manifest.mjs";
import { commitManifest, processFreshEntry, processManifestEntries } from "./lib/asset-manifest-cache.mjs";
import {
  ART_TRANSFORM_CONCURRENCY,
  ASSET_SCHEMA_VERSION,
  GEAR_SLOT_IDS,
  MANIFEST_BASENAME,
  SHARP_DEFAULTS,
  artPreset,
} from "./lib/asset-constants.mjs";
import { failedOptimizeResult, targetErrorHandler } from "./lib/process-helpers.mjs";
import { runPipelineScript } from "./lib/audio-optimizer.mjs";
import { getOptimizedManifestPath, resolveRootDir } from "./lib/sync-generated-helpers.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const rootDir = resolveRootDir(import.meta.url);
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");
const manifestPath = getOptimizedManifestPath(rootDir);

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = ART_TRANSFORM_CONCURRENCY;

const gearPreset = artPreset("gear");
const gearAssetWidth = gearPreset.width;
const gearAssetQuality = gearPreset.quality;

/** OS metadata files are never authoring sources. */
const IGNORED_SOURCE_FILES = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);

function slugifyGearName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function discoverFiles({ dir, pattern, validate }) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      const wrapped = new Error(
        `Missing Raw Assets source "${dir}". This checkout may exclude raw sources; asset prep requires the full Raw Assets/ tree.`,
        { cause: error },
      );
      wrapped.code = error.code;
      wrapped.path = error.path ?? dir;
      throw wrapped;
    }
    throw error;
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (IGNORED_SOURCE_FILES.has(entry.name.toLowerCase())) continue;
    const match = entry.name.match(pattern);
    if (!match) {
      const skip = validate.skip?.(entry.name);
      if (skip) continue;
      throw new Error(validate.malformed(entry.name));
    }
    const asset = validate.map(match, entry.name);
    if (asset) discovered.push(asset);
  }
  validate.check?.(discovered);
  return discovered;
}

async function discoverGearAssets() {
  return discoverFiles({
    dir: path.join(sourceDir, "Gear"),
    pattern: /^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i,
    validate: {
      skip: (name) => name.toLowerCase().includes("placeholder"),
      malformed: (name) => `[gear] Malformed gear file: ${name} (expected "{Name} - {Basic|Astral}.{jpeg|jpg|png}")`,
      map: (match, fileName) => {
        const [, displayName, rarity] = match;
        return {
          source: `Gear/${fileName}`,
          target: `gear-${slugifyGearName(displayName)}-${rarity.toLowerCase()}.webp`,
          width: gearAssetWidth,
          quality: gearAssetQuality,
        };
      },
    },
  });
}

async function discoverGearSlotBackgrounds() {
  const foundSlotIds = new Set();
  const discovered = await discoverFiles({
    dir: path.join(sourceDir, "Gear", "Gear Slot Backgrounds"),
    pattern: /^(.+?)\sSlot\.(jpe?g|png)$/i,
    validate: {
      malformed: (name) =>
        `[gear-slot] Malformed slot background file: ${name} (expected "{Slot} Slot.{jpeg|jpg|png}")`,
      map: (match, fileName) => {
        const displayName = match[1].trim().toLowerCase();
        if (!GEAR_SLOT_IDS.includes(displayName)) {
          throw new Error(
            `[gear-slot] Unknown slot background name: ${match[1]} (allowed: ${GEAR_SLOT_IDS.join(", ")})`,
          );
        }
        foundSlotIds.add(displayName);
        return {
          source: `Gear/Gear Slot Backgrounds/${fileName}`,
          target: `gear-slot-${displayName}.webp`,
          width: gearAssetWidth,
          quality: gearAssetQuality,
        };
      },
    },
  });

  for (const slotId of GEAR_SLOT_IDS) {
    if (!foundSlotIds.has(slotId)) {
      throw new Error(`[gear-slot] Missing background art for slot: ${slotId}`);
    }
  }

  return discovered;
}

function artTransformSettings({ width, quality }) {
  return {
    width,
    quality,
    ...SHARP_DEFAULTS,
  };
}

function applyArtTransform(image, settings) {
  return image
    .resize({ width: settings.width, fit: settings.fit, withoutEnlargement: settings.withoutEnlargement })
    .webp({ quality: settings.quality, alphaQuality: settings.alphaQuality, effort: settings.effort });
}

/**
 * @param {{ source: string, target: string, width: number, quality: number }} asset
 * @param {import("./lib/asset-manifest-cache.mjs").ManifestEntry | undefined} storedEntry
 */
async function optimizeAsset(asset, storedEntry) {
  const sourcePath = path.join(sourceDir, asset.source);
  const outputPath = path.join(outputDir, asset.target);
  const settings = artTransformSettings({ width: asset.width, quality: asset.quality });

  const { fresh, entry } = await processFreshEntry(sourcePath, outputPath, settings, SCHEMA_VERSION, storedEntry, () =>
    applyArtTransform(sharp(sourcePath), settings).toFile(outputPath),
  );
  return { message: `${asset.target} ${fresh ? "already up to date" : "optimized"}`, entry };
}

export async function optimizeAssets() {
  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  await validateAssetRegistry(allAssets, { sourceDir });

  await mkdir(outputDir, { recursive: true });

  const { results, nextManifest, failed } = await processManifestEntries({
    entries: allAssets,
    manifestPath,
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: optimizeAsset,
    handleError: targetErrorHandler,
  });

  if (failed) {
    return failedOptimizeResult(results, "art manifest write and orphan sweep");
  }

  await commitManifest(manifestPath, nextManifest, {
    outputDir,
    manifestBasename: MANIFEST_BASENAME,
    label: "optimized asset",
  });

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
  return { ok: true };
}

if (isMainModule(import.meta.url)) {
  runPipelineScript("Asset optimization", optimizeAssets);
}
