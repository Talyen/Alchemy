import { readdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

export async function discoverAudioFiles(dir, extensions = DEFAULT_AUDIO_EXTENSIONS) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}
