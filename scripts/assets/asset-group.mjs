import path from "node:path";

/**
 * Expand explicit library selections; never discover files from a directory.
 * Strings retain their basename (optionally changing format); tuples pin an
 * output name and may override group settings for an individual selection.
 * @template {object} Settings
 * @param {{ folder: string, settings: Settings, targetExtension?: string }} options
 * @param {readonly (string | readonly [source: string, target: string, settings?: Partial<Settings>])[]} selections
 * @returns {(Settings & { source: string, target: string })[]}
 */
export function assetGroup({ folder, settings, targetExtension }, selections) {
  return selections.map((selection) => {
    const [source, target, overrides] = typeof selection === "string" ? [selection] : selection;
    const basename = path.posix.basename(source);
    return {
      ...settings,
      ...overrides,
      source: `${folder.replace(/\/$/u, "")}/${source}`,
      target: target ?? (targetExtension ? basename.replace(/\.[^.]+$/, targetExtension) : basename),
    };
  });
}
