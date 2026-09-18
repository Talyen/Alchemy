import { validateRegistryEntries } from "../lib/registry-validation.mjs";

export const MUSIC_FILE_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

/**
 * Filename-only registry for discovered music. Music needs no per-target
 * quality tuning, but duplicate basenames and unsupported extensions must fail
 * like art/sound registries instead of silently publishing.
 */
export async function validateMusicRegistry(files) {
  await validateRegistryEntries(
    files.map((file) => ({ source: file, target: file })),
    {
      targetKey: "target",
      sourcePattern: /\.(mp3|ogg|wav)$/iu,
      targetPattern: /\.(mp3|ogg|wav)$/u,
      label: "Music asset registry",
      // Filesystems disagree on case: "Theme.ogg" vs "theme.ogg" would collide
      // on macOS/Windows checkouts, so duplicates compare case-insensitively.
      caseInsensitiveDuplicates: true,
    },
  );
  return files;
}
