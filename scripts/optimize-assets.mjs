import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { staticAssets } from "./assets/asset-manifest.mjs";
import { isOutputFresh, loadManifest, resolveSourceHash, writeManifestIfChanged } from "./lib/asset-manifest-cache.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { mapPool } from "./lib/map-pool.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");
const manifestPath = path.join(outputDir, ".asset-hashes.json");
const MANIFEST_BASENAME = ".asset-hashes.json";

/** Bump when sharp pipeline settings, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 2;
const TRANSFORM_CONCURRENCY = 6;

const gearAssetWidth = 420;
const gearAssetQuality = 82;

const GEAR_SLOT_IDS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "amulet",
  "left-ring",
  "right-ring",
];

const GEAR_SLOT_BACKGROUND_NAME_TO_ID = {
  amulet: "amulet",
  belt: "belt",
  body: "body",
  boots: "boots",
  gloves: "gloves",
  helm: "helm",
  "left ring": "left-ring",
  "main hand": "main-hand",
  "off-hand": "off-hand",
  "right ring": "right-ring",
};

function slugifyGearName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function discoverGearAssets() {
  const gearDir = path.join(sourceDir, "Gear");
  let entries;
  try {
    entries = await readdir(gearDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
    if (!match) {
      if (!entry.name.toLowerCase().includes("placeholder")) {
        console.warn(`[gear] Skipping malformed gear file: ${entry.name}`);
      }
      continue;
    }
    const [, displayName, rarity] = match;
    discovered.push({
      source: `Gear/${entry.name}`,
      target: `gear-${slugifyGearName(displayName)}-${rarity.toLowerCase()}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }
  return discovered;
}

async function discoverGearSlotBackgrounds() {
  const slotDir = path.join(sourceDir, "Gear", "Gear Slot Backgrounds");
  let entries;
  try {
    entries = await readdir(slotDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  const foundSlotIds = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\sSlot\.(jpe?g|png)$/i);
    if (!match) {
      console.warn(`[gear-slot] Skipping malformed slot background file: ${entry.name}`);
      continue;
    }
    const displayName = match[1].trim().toLowerCase();
    const slotId = GEAR_SLOT_BACKGROUND_NAME_TO_ID[displayName];
    if (!slotId) {
      console.warn(`[gear-slot] Unknown slot background name: ${match[1]}`);
      continue;
    }
    foundSlotIds.add(slotId);
    discovered.push({
      source: `Gear/Gear Slot Backgrounds/${entry.name}`,
      target: `gear-slot-${slotId}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }

  for (const slotId of GEAR_SLOT_IDS) {
    if (!foundSlotIds.has(slotId)) {
      console.warn(`[gear-slot] Missing background art for slot: ${slotId}`);
    }
  }

  return discovered;
}

function artTransformSettings({ width, quality }) {
  return {
    width,
    quality,
    alphaQuality: 90,
    effort: 6,
    fit: "inside",
    withoutEnlargement: true,
    format: "webp",
  };
}

/**
 * @param {{ source: string, target: string, width: number, quality: number }} asset
 * @param {import("./lib/asset-manifest-cache.mjs").ManifestEntry | undefined} storedEntry
 */
async function optimizeAsset(asset, storedEntry) {
  const sourcePath = path.join(sourceDir, asset.source);
  const outputPath = path.join(outputDir, asset.target);

  let sourceEntry;
  try {
    sourceEntry = await resolveSourceHash(
      sourcePath,
      artTransformSettings({ width: asset.width, quality: asset.quality }),
      SCHEMA_VERSION,
      storedEntry,
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { message: `${asset.target} missing source`, hash: null, missing: true };
    }
    throw error;
  }

  const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
  if (isFresh) {
    return { message: `${asset.target} already up to date`, entry: sourceEntry, missing: false };
  }

  await sharp(sourcePath)
    .resize({ width: asset.width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: asset.quality, alphaQuality: 90, effort: 6 })
    .toFile(outputPath);

  return { message: `${asset.target} optimized`, entry: sourceEntry, missing: false };
}

function validateAssetTargets(assetEntries) {
  const seenTargets = new Map();
  for (const asset of assetEntries) {
    const previousSource = seenTargets.get(asset.target);
    if (previousSource) {
      throw new Error(
        `Duplicate optimized asset target "${asset.target}" from "${previousSource}" and "${asset.source}".`,
      );
    }
    seenTargets.set(asset.target, asset.source);
  }
}

/**
 * Delete files in the managed output directory that are not manifest targets.
 * @param {Set<string>} targetNames
 */
async function removeOrphanOutputs(targetNames) {
  let entries;
  try {
    entries = await readdir(outputDir);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const name of entries) {
    if (name === MANIFEST_BASENAME) continue;
    if (targetNames.has(name)) continue;
    await unlink(path.join(outputDir, name));
    removed += 1;
    console.log(`Removed orphan optimized asset: ${name}`);
  }
  return removed;
}

export async function optimizeAssets() {
  await mkdir(outputDir, { recursive: true });

  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  validateAssetTargets(allAssets);

  const previousManifest = await loadManifest(manifestPath);

  const results = await mapPool(allAssets, TRANSFORM_CONCURRENCY, async (asset) => {
    const result = await optimizeAsset(asset, previousManifest[asset.target]);
    if (result.missing) {
      console.error(`Missing art source for ${asset.target}: ${asset.source}`);
    }
    return { asset, ...result };
  });

  /** @type {Record<string, import("./lib/asset-manifest-cache.mjs").ManifestEntry>} */
  const nextManifest = {};
  let missingCount = 0;
  for (const result of results) {
    if (result.missing) {
      missingCount += 1;
      continue;
    }
    if (result.entry) {
      nextManifest[result.asset.target] = result.entry;
    }
  }

  // Single manifest write after the parallel pass.
  await writeManifestIfChanged(manifestPath, nextManifest);

  if (missingCount === 0) {
    await removeOrphanOutputs(new Set(Object.keys(nextManifest)));
  } else {
    process.exitCode = 1;
  }

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
}

if (isMainModule(import.meta.url)) {
  optimizeAssets().catch((error) => {
    console.error("Asset optimization failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
