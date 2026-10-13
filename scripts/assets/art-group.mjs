/**
 * Explicit source/output pairs share a folder and transform settings; adding
 * files to Asset Library never changes the selected inventory.
 * @param {{ folder: string, preset: { width: number, quality: number }, requiresTransparency?: boolean }} options
 * @param {readonly (readonly [source: string, target: string])[]} entries
 */
export function artGroup({ folder, preset, requiresTransparency }, entries) {
  return entries.map(([source, target]) => ({
    source: `2d Assets/Game Sources/${folder}/${source}`,
    target,
    ...preset,
    ...(requiresTransparency === undefined ? {} : { requiresTransparency }),
  }));
}
