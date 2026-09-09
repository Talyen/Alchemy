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

export function runPipelineScript(label, scriptFn) {
  scriptFn()
    .then((result) => {
      if (!result || result.ok !== true) {
        if (result?.error) console.error(result.error);
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(`${label} failed.`);
      console.error(error);
      process.exitCode = 1;
    });
}
