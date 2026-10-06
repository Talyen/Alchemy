import path from "node:path";
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
  {
    source: "Sounds/Game Sources/Music/Battle 1.mp3",
    target: "Battle 1.mp3",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Music/Battle 2.mp3",
    target: "Battle 2.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Battle 3.mp3",
    target: "Battle 3.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Battle 4.mp3",
    target: "Battle 4.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Battle 5.mp3",
    target: "Battle 5.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Menu 1.mp3",
    target: "Menu 1.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Menu 2.mp3",
    target: "Menu 2.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Menu 3.mp3",
    target: "Menu 3.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/Menu 4.mp3",
    target: "Menu 4.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/The Blight Treant.mp3",
    target: "The Blight Treant.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/The Forge Golem.mp3",
    target: "The Forge Golem.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/The Frostwarden.mp3",
    target: "The Frostwarden.mp3",
  },
  {
    source: "Sounds/Game Sources/Music/The Iron Bear.mp3",
    target: "The Iron Bear.mp3",
  },
];
