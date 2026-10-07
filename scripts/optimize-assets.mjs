import path from "node:path";

import sharp from "sharp";

import { gearAssets } from "./assets/gear-assets.mjs";
import { resolveAssetSource, requireAssetSources } from "./assets/asset-library.mjs";
import { selectionHash } from "./assets/asset-manifest-cache.mjs";
import { staticAssets, validateAssetRegistry } from "./assets/asset-manifest.mjs";
import { processFreshEntry } from "./assets/asset-manifest-cache.mjs";
import {
  ART_TRANSFORM_CONCURRENCY,
  ASSET_SCHEMA_VERSION,
  MANIFEST_BASENAME,
  SHARP_DEFAULTS,
} from "./assets/asset-constants.mjs";
import {
  ensureOutputDir,
  resolvePipelinePaths,
  runManifestPipeline,
  writeStagedOutput,
} from "./assets/asset-pipeline-runner.mjs";
import { runPipelineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";

const { outputDir, manifestPath } = resolvePipelinePaths(import.meta.url, {
  managedKey: "art",
});

const SCHEMA_VERSION = ASSET_SCHEMA_VERSION;
const TRANSFORM_CONCURRENCY = ART_TRANSFORM_CONCURRENCY;

export function artTransformSettings({ width, quality, requiresTransparency = false }) {
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
  const sourcePath = resolveAssetSource(asset.source);
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
    () =>
      writeStagedOutput(outputPath, async (temporaryPath) => {
        // Validate staged bytes before replacing the last usable prepared image.
        await applyArtTransform(sharp(sourcePath), settings).toFile(temporaryPath);
        if (asset.requiresTransparency) await validateTransparency(temporaryPath, `Prepared ${asset.target}`);
      }),
    { check },
  );
  // Fresh-hit output re-validation is intentional tamper-evidence (pinned by
  // art-transparency.test.ts): committed outputs are binary blobs reviewers
  // cannot eyeball, so a corrupted output with a matching manifest hash must
  // still fail rather than ship broken transparency silently.
  if (fresh && asset.requiresTransparency) await validateTransparency(outputPath, `Prepared ${asset.target}`);
  return {
    message: `${asset.target} ${fresh ? "already up to date" : "optimized"}`,
    entry: { ...entry, selectionHash: selectionHash(asset, settings) },
  };
}

export async function optimizeAssets({ check = false } = {}) {
  const allAssets = [...staticAssets, ...gearAssets];
  await validateAssetRegistry(allAssets);
  await requireAssetSources(allAssets, { manifestPath, settingsFor: artTransformSettings });

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
    `${check ? "Checked" : "Optimized"} ${result.results.length} art assets (${gearAssets.length} gear and slot backgrounds).`,
  );
  return { ok: true };
}

runPipelineScript(import.meta.url, "Asset optimization", () => {
  const { flags, rest } = parseKnownFlags(process.argv.slice(2), { check: {} });
  if (rest.length) throw new UsageError(`Unexpected optimization arguments: ${rest.join(", ")}`);
  return optimizeAssets({ check: flags.has("check") });
});
