import path from "node:path";
import {
  computeContentHash,
  computeOutputHash,
  loadManifest,
  selectionHash,
  writeManifestIfChanged,
} from "./asset-manifest-cache.mjs";
import { ASSET_SCHEMA_VERSION } from "./asset-constants.mjs";
import { requireAssetSources, resolveAssetSource } from "./asset-library.mjs";

export const iconSource = "2d Assets/Game Sources/Branding/App Icons/Alchemy Icon Master.png";
export const iconOutputs = [
  "public/favicon-16x16.png",
  "public/favicon-32x32.png",
  "public/favicon-48x48.png",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/icon-maskable-192.png",
  "public/icon-maskable-512.png",
  "public/site.webmanifest",
  "desktop/icons/icon.ico",
  "desktop/icons/icon.png",
  "desktop/icons/icon-1024.png",
];

export async function checkIconAssets(root, { outputsOnly = false, record = false } = {}) {
  if (outputsOnly && record) throw new Error("Cannot record icons without local source verification.");
  const filename = path.join(root, "desktop/icons/.asset-hashes.json");
  const manifest = await loadManifest(filename);
  const settings = { generatorHash: await computeOutputHash(path.join(root, "scripts/generate-icons.mjs")) };
  const fingerprint = selectionHash({ source: iconSource, outputs: iconOutputs }, settings);
  let sourceHash;
  if (!outputsOnly) {
    await requireAssetSources([{ source: iconSource }]);
    sourceHash = await computeContentHash(resolveAssetSource(iconSource), settings, ASSET_SCHEMA_VERSION);
  }
  if (!record && JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify([...iconOutputs].sort())) {
    throw new Error("Prepared icon inventory changed. Run npm run generate:icons locally.");
  }
  const next = {};
  for (const target of iconOutputs) {
    const outputHash = await computeOutputHash(path.join(root, target));
    if (
      !record &&
      (manifest[target]?.selectionHash !== fingerprint ||
        manifest[target]?.outputHash !== outputHash ||
        (!outputsOnly && manifest[target]?.hash !== sourceHash))
    ) {
      throw new Error(`Prepared icon/source/settings changed: ${target}. Run npm run generate:icons locally.`);
    }
    next[target] = { hash: sourceHash, outputHash, selectionHash: fingerprint };
  }
  if (record) await writeManifestIfChanged(filename, next);
}
