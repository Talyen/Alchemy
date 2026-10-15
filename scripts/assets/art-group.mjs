import { assetGroup } from "./asset-group.mjs";

/**
 * Explicit source/output pairs share a folder and transform settings; adding
 * files to Asset Library never changes the selected inventory.
 * @param {{ folder: string, preset: { width: number, quality: number }, requiresTransparency?: boolean }} options
 * @param {readonly (readonly [source: string, target: string, preset?: { width: number, quality: number }])[]} entries
 */
export function artGroup({ folder, preset, requiresTransparency }, entries) {
  return assetGroup(
    {
      folder: `2d Assets/Game Sources/${folder}`,
      settings: { ...preset, ...(requiresTransparency === undefined ? {} : { requiresTransparency }) },
    },
    entries,
  );
}
