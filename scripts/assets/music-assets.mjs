import path from "node:path";
import { assetGroup } from "./asset-group.mjs";
import { validateRegistryEntries } from "./registry-validation.mjs";

/**
 * Music is copied unchanged. Validate both explicit selections and filename
 * inventories before publishing into the fully managed output directory.
 */
export async function validateMusicRegistry(files) {
  const entries = files.map((file) => (typeof file === "string" ? { source: file, target: file } : file));
  await validateRegistryEntries(entries, {
    targetKey: "target",
    sourcePattern: /\.(mp3|ogg|wav)$/iu,
    targetPattern: /^[^/\\]+\.(mp3|ogg|wav)$/u,
    label: "Music asset registry",
    // Filesystems disagree on case: "Theme.ogg" vs "theme.ogg" would collide
    // on macOS/Windows checkouts, so duplicates compare case-insensitively.
    caseInsensitiveDuplicates: true,
  });
  for (const { source, target } of entries) {
    if (path.extname(source).toLowerCase() !== path.extname(target).toLowerCase()) {
      throw new Error(`Music is copied without conversion; source "${source}" must match the format of "${target}".`);
    }
  }
  return files;
}

// Explicit selection keeps the shared library independent of this game's soundtrack.
export const musicAssets = [
  ...assetGroup({ folder: "Sounds/Game Sources/Music", settings: {} }, ["Battle 1.mp3"]),
  ...assetGroup({ folder: "Sounds/Game Sources/Projects/Alchemy/Music", settings: {} }, ["Battle 2.mp3"]),
  ...assetGroup({ folder: "Sounds/Game Sources/Music", settings: {} }, [
    "Battle 3.mp3",
    "Battle 4.mp3",
    "Battle 5.mp3",
    "Menu 1.mp3",
    "Menu 2.mp3",
    "Menu 3.mp3",
    "Menu 4.mp3",
    "The Blight Treant.mp3",
    "The Blood Countess - Boss Track.mp3",
    "The Forge Golem.mp3",
    "The Frostwarden.mp3",
    "The Iron Bear.mp3",
  ]),
];
