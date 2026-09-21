import { rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";

import { staticAssets, validateAssetRegistry } from "./assets/asset-manifest.mjs";
import { processFreshEntry } from "./assets/asset-manifest-cache.mjs";
import {
  ART_TRANSFORM_CONCURRENCY,
  ASSET_SCHEMA_VERSION,
  ART_PRESETS,
  MANIFEST_BASENAME,
  SHARP_DEFAULTS,
} from "./assets/asset-constants.mjs";
import {
  ensureOutputDir,
  readSourceDir,
  resolvePipelinePaths,
  runManifestPipeline,
} from "./assets/asset-pipeline-runner.mjs";
import { GEAR_FILE_PATTERN, GEAR_SLOT_IDS, SLOT_BACKGROUND_PATTERN, toGearTarget } from "./assets/gear-filenames.mjs";
import { runPipelineScript } from "./lib/script-run.mjs";

const { sourceDir, outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, {
  sourceSubpath: ["Raw Assets"],
  managedKey: "art",
});

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = ART_TRANSFORM_CONCURRENCY;

const gearPreset = ART_PRESETS.gear;
const gearAssetWidth = gearPreset.width;
const gearAssetQuality = gearPreset.quality;

/** OS metadata files are never authoring sources. */
const IGNORED_SOURCE_FILES = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);

async function discoverFiles({ dir, pattern, validate }) {
  const entries = await readSourceDir(dir);

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
    pattern: GEAR_FILE_PATTERN,
    validate: {
      skip: (name) => name.toLowerCase().includes("placeholder"),
      malformed: (name) => `[gear] Malformed gear file: ${name} (expected "{Name} - {Basic|Astral}.{jpeg|jpg|png}")`,
      map: (match, fileName) => {
        const [, displayName, rarity] = match;
        return {
          source: `Gear/${fileName}`,
          target: toGearTarget(displayName, rarity),
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
    pattern: SLOT_BACKGROUND_PATTERN,
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

function artTransformSettings({ width, quality, requiresTransparency = false }) {
  return {
    width,
    quality,
    ...SHARP_DEFAULTS,
    ...(requiresTransparency ? { requiresTransparency: true } : {}),
  };
}

function applyArtTransform(image, settings) {
  return image
    .resize({ width: settings.width, fit: settings.fit, withoutEnlargement: settings.withoutEnlargement })
    .webp({ quality: settings.quality, alphaQuality: settings.alphaQuality, effort: settings.effort });
}

async function validateTransparency(filename, label) {
  // metadata() reads headers only (cheap); stats() is the single full decode.
  const image = sharp(filename);
  const { hasAlpha } = await image.metadata();
  if (hasAlpha) {
    const { channels } = await image.stats();
    const alpha = channels.at(-1);
    if (alpha.min === 0 && alpha.max > 0) return;
  }
  throw new Error(
    `${label} requires fully transparent pixels and visible artwork; an alpha channel or painted checkerboard alone is insufficient.`,
  );
}

/**
 * @param {{ source: string, target: string, width: number, quality: number, requiresTransparency?: boolean }} asset
 * @param {import("./assets/asset-manifest-cache.mjs").ManifestEntry | undefined} storedEntry
 */
async function optimizeAsset(asset, storedEntry, check) {
  const sourcePath = path.join(sourceDir, asset.source);
  const outputPath = path.join(outputDir, asset.target);
  const settings = artTransformSettings(asset);
  // Source validation stays ahead of the freshness gate: an invalid source
  // must fail with its specific reason even in check mode, where a stale
  // output would otherwise report a generic staleness error first.
  if (asset.requiresTransparency) await validateTransparency(sourcePath, `Source ${asset.source}`);
  const { fresh, entry } = await processFreshEntry(
    sourcePath,
    outputPath,
    settings,
    SCHEMA_VERSION,
    storedEntry,
    async () => {
      // Validate staged bytes before replacing the last usable prepared image.
      const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
      try {
        await applyArtTransform(sharp(sourcePath), settings).toFile(temporaryPath);
        if (asset.requiresTransparency) await validateTransparency(temporaryPath, `Prepared ${asset.target}`);
        await rename(temporaryPath, outputPath);
      } finally {
        await rm(temporaryPath, { force: true });
      }
    },
    { check },
  );
  // Fresh-hit output re-validation is intentional tamper-evidence (pinned by
  // art-transparency.test.ts): committed outputs are binary blobs reviewers
  // cannot eyeball, so a corrupted output with a matching manifest hash must
  // still fail rather than ship broken transparency silently.
  if (fresh && asset.requiresTransparency) await validateTransparency(outputPath, `Prepared ${asset.target}`);
  return { message: `${asset.target} ${fresh ? "already up to date" : "optimized"}`, entry };
}

export async function optimizeAssets({ check = false } = {}) {
  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  await validateAssetRegistry(allAssets, { sourceDir });

  await ensureOutputDir(outputDir, { check });

  const result = await runManifestPipeline({
    entries: allAssets,
    manifestPath,
    outputDir,
    manifestBasename: MANIFEST_BASENAME,
    label: "optimized asset",
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: (asset, storedEntry) => optimizeAsset(asset, storedEntry, check),
    check,
    skipLabel: "art manifest write and orphan sweep",
  });
  if (!result.ok) return result;

  console.log(
    `${check ? "Checked" : "Optimized"} ${result.results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
  return { ok: true };
}

runPipelineScript(import.meta.url, "Asset optimization", optimizeAssets);
