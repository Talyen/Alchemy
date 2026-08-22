import { readdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav"]);

export async function discoverAudioFiles(dir, extensions = DEFAULT_AUDIO_EXTENSIONS) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

export function formatProcessError(label, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`FAILED ${label}: ${detail}`);
  return { message: `FAILED ${label}: ${detail}`, entry: null };
}

export function runAudioScript(label, scriptFn) {
  scriptFn()
    .then(({ ok }) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`${label} failed.`);
      console.error(error);
      process.exitCode = 1;
    });
}
