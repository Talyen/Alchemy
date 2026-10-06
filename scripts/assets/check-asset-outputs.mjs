import path from "node:path";
import { staticAssets, validateAssetRegistry } from "./asset-manifest.mjs";
import { gearAssets } from "./gear-assets.mjs";
import { musicAssets, validateMusicRegistry } from "./music-assets.mjs";
import {
  curatedSoundFiles,
  generatedSoundAssets,
  mp3FallbackName,
  soundEntryOwner,
  validateSoundAssetRegistry,
} from "./sound-assets.mjs";
import {
  MANAGED_DIRS,
  MANIFEST_BASENAME,
  MUSIC_SETTINGS,
  CURATED_SOUND_SETTINGS,
  MP3_FALLBACK_SETTINGS,
  soundTransformSettings,
} from "./asset-constants.mjs";
import { commitManifest, loadManifest, computeOutputHash, selectionHash } from "./asset-manifest-cache.mjs";
import { artTransformSettings } from "../optimize-assets.mjs";
import { requireAssetSources } from "./asset-library.mjs";

export async function preflightSelectedSources() {
  await requireAssetSources([...staticAssets, ...gearAssets, ...generatedSoundAssets, ...musicAssets]);
}

/** Check committed selections, settings and bytes; never inspect external sources. */
export async function checkAssetOutputs(rootDir) {
  const art = [...staticAssets, ...gearAssets];
  await validateAssetRegistry(art);
  await validateSoundAssetRegistry();
  await validateMusicRegistry(musicAssets);
  const oggs = [...generatedSoundAssets.map(({ target }) => target), ...curatedSoundFiles];
  const selections = {
    art: art.map((asset) => ({ asset, settings: artTransformSettings(asset) })),
    music: musicAssets.map((asset) => ({ asset, settings: MUSIC_SETTINGS })),
    sounds: [
      ...generatedSoundAssets.map((asset) => ({
        asset,
        settings: soundTransformSettings(path.extname(asset.source).toLowerCase()),
      })),
      ...curatedSoundFiles.map((target) => ({ asset: { source: target, target }, settings: CURATED_SOUND_SETTINGS })),
      ...oggs.map((source) => ({
        asset: { source, target: mp3FallbackName(source) },
        settings: MP3_FALLBACK_SETTINGS,
      })),
    ],
  };
  for (const [kind, entries] of Object.entries(selections)) {
    const outputDir = path.join(rootDir, MANAGED_DIRS[kind].dir);
    const manifestPath = path.join(outputDir, MANIFEST_BASENAME);
    const manifest = await loadManifest(manifestPath);
    const targets = entries.map(({ asset }) => asset.target).sort();
    if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(targets)) {
      throw new Error(`Prepared ${kind} inventory differs from its selection. Regenerate assets locally.`);
    }
    for (const { asset, settings } of entries) {
      const entry = manifest[asset.target];
      if (entry.selectionHash !== selectionHash(asset, settings)) {
        throw new Error(`Prepared selection/settings changed: ${asset.target}. Regenerate assets locally.`);
      }
      if (!entry.outputHash || (await computeOutputHash(path.join(outputDir, asset.target))) !== entry.outputHash) {
        throw new Error(`Prepared output bytes changed: ${asset.target}. Regenerate assets locally.`);
      }
      if (kind === "sounds" && entry.owner !== soundEntryOwner(asset.target.replace(/\.mp3$/u, ".ogg"))) {
        throw new Error(`Prepared sound ownership changed: ${asset.target}`);
      }
    }
    await commitManifest(manifestPath, manifest, { outputDir, check: true });
  }
}
