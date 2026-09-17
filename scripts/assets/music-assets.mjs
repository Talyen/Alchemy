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
    },
  );
  const seen = new Map();
  const duplicates = [];
  for (const file of files) {
    const key = file.toLowerCase();
    if (seen.has(key) && seen.get(key) !== file) duplicates.push(`Duplicate music file "${file}" (${seen.get(key)}).`);
    else if (seen.has(key)) duplicates.push(`Duplicate music file "${file}".`);
    else seen.set(key, file);
  }
  if (duplicates.length > 0) {
    throw new Error(`Music asset registry validation failed:\n- ${duplicates.join("\n- ")}`);
  }
  return files;
}
