import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { staticAssets, validateAssetRegistry } from "./assets/asset-manifest.mjs";
import {
  isOutputFresh,
  processManifestEntries,
  removeOrphanOutputs,
  resolveSourceHash,
  withOutputHash,
} from "./lib/asset-manifest-cache.mjs";
import {
  ART_TRANSFORM_CONCURRENCY,
  ASSET_SCHEMA_VERSION,
  MANIFEST_BASENAME,
  QUALITY,
  SHARP_DEFAULTS,
  WIDTH,
} from "./lib/asset-constants.mjs";
import { formatProcessError } from "./lib/process-helpers.mjs";
import { runAudioScript } from "./lib/audio-optimizer.mjs";
import { getOptimizedManifestPath, resolveRootDir } from "./lib/sync-generated-helpers.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const rootDir = resolveRootDir(import.meta.url);
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");
const manifestPath = getOptimizedManifestPath(rootDir);

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = ART_TRANSFORM_CONCURRENCY;

const gearAssetWidth = WIDTH.gear;
const gearAssetQuality = QUALITY.gear;

const GEAR_SLOT_IDS = ["body", "weapon", "accessory", "trinket"];

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
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
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

/**
 * @param {{ source: string, target: string, width: number, quality: number }} asset
 * @param {import("./lib/asset-manifest-cache.mjs").ManifestEntry | undefined} storedEntry
 */
async function optimizeAsset(asset, storedEntry) {
  const sourcePath = path.join(sourceDir, asset.source);
  const outputPath = path.join(outputDir, asset.target);
  const sourceEntry = await resolveSourceHash(
    sourcePath,
    artTransformSettings({ width: asset.width, quality: asset.quality }),
    SCHEMA_VERSION,
    storedEntry,
  );

  const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
  if (isFresh) {
    return { message: `${asset.target} already up to date`, entry: storedEntry };
  }

  await sharp(sourcePath)
    .resize({ width: asset.width, fit: SHARP_DEFAULTS.fit, withoutEnlargement: SHARP_DEFAULTS.withoutEnlargement })
    .webp({ quality: asset.quality, alphaQuality: SHARP_DEFAULTS.alphaQuality, effort: SHARP_DEFAULTS.effort })
    .toFile(outputPath);

  return { message: `${asset.target} optimized`, entry: await withOutputHash(sourceEntry, outputPath) };
}

export async function optimizeAssets() {
  await mkdir(outputDir, { recursive: true });

  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  await validateAssetRegistry(allAssets, { sourceDir });

  const { results, nextManifest, failed } = await processManifestEntries({
    entries: allAssets,
    manifestPath,
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: optimizeAsset,
    handleError: (asset, error) => formatProcessError(asset.target, error),
  });

  if (!failed) {
    const removed = await removeOrphanOutputs(outputDir, new Set(Object.keys(nextManifest)), {
      manifestBasename: MANIFEST_BASENAME,
      label: "optimized asset",
    });
    if (removed > 0) {
      console.log(`Removed ${removed} orphan optimized assets.`);
    }
  } else {
    console.warn("Skipping orphan optimized-asset sweep because art optimization failed.");
  }

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
  return { ok: !failed, error: failed ? "One or more art assets failed" : undefined };
}

if (isMainModule(import.meta.url)) {
  runAudioScript("Asset optimization", optimizeAssets);
}
