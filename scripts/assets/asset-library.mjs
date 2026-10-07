import path from "node:path";
import os from "node:os";
import { open, readdir } from "node:fs/promises";
import { computeContentHash, loadManifest, selectionHash } from "./asset-manifest-cache.mjs";
import { ASSET_SCHEMA_VERSION } from "./asset-constants.mjs";

const recoveredSources = new Map();

export function assetLibraryRoot() {
  return path.resolve(process.env.ASSET_LIBRARY_ROOT || path.join(os.homedir(), "Documents", "Asset Library"));
}

export function resolveAssetSource(source) {
  const root = assetLibraryRoot();
  const resolved = path.resolve(root, source);
  if (!source || path.isAbsolute(source) || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Asset source must be library-relative: ${source}`);
  }
  return recoveredSources.get(resolved) ?? resolved;
}

async function readableSource(filename) {
  const file = await open(filename, "r");
  try {
    if (!(await file.stat()).isFile()) throw new Error("Not a file");
    const buffer = Buffer.alloc(1);
    if ((await file.read(buffer, 0, 1, 0)).bytesRead === 0) throw new Error("Empty source");
  } finally {
    await file.close();
  }
}

// Stay inside the configured library and never traverse symlinks. A moved
// source must still use the same format, since audio recipes depend on it.
async function libraryFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (["ENOENT", "EACCES", "EPERM"].includes(error.code)) return files;
    throw error;
  }
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await libraryFiles(filename)));
    else if (entry.isFile()) files.push(filename);
  }
  return files.sort();
}

/** Read each selected source before any pipeline can publish or prune outputs.
 * Missing paths recover only from a receipt for the unchanged selection/recipe.
 * Resolution is process-local: read-only checks never rewrite manifests or files.
 */
export async function requireAssetSources(entries, recovery) {
  let manifest;
  let candidates;
  const hashes = new Map();
  for (const entry of entries) {
    const { source } = entry;
    resolveAssetSource(source); // Validate the library-relative selection.
    const filename = path.resolve(assetLibraryRoot(), source);
    const previous = recoveredSources.get(filename);
    recoveredSources.delete(filename);
    try {
      await readableSource(filename);
    } catch (cause) {
      // Unreadable/offloaded or empty files are not evidence of a move.
      if (cause.code === "ENOENT" && recovery) {
        manifest ??= await loadManifest(recovery.manifestPath);
        const settings = recovery.settingsFor(entry);
        const selection = recovery.selectionFor?.(entry) ?? entry;
        const receipt = manifest[entry.target];
        if (receipt?.selectionHash === selectionHash(selection, settings)) {
          candidates ??= await libraryFiles(assetLibraryRoot());
          const extension = path.extname(source).toLowerCase();
          const preferred = candidates.filter(
            (candidate) => candidate === previous || path.basename(candidate) === path.basename(source),
          );
          const remaining = candidates.filter((candidate) => !preferred.includes(candidate));
          for (const candidate of [...preferred, ...remaining]) {
            if (path.extname(candidate).toLowerCase() !== extension) continue;
            const key = JSON.stringify([candidate, settings]);
            let hash = hashes.get(key);
            try {
              if (!hash) {
                hash = await computeContentHash(candidate, settings, ASSET_SCHEMA_VERSION);
                hashes.set(key, hash);
              }
            } catch {
              continue;
            }
            if (hash !== receipt.hash) continue;
            await readableSource(candidate);
            // Identical duplicates are interchangeable; sorted paths make the
            // choice deterministic. Different revisions never match by name.
            const original = path.resolve(assetLibraryRoot(), source);
            recoveredSources.set(original, candidate);
            console.log(
              `Recovered Asset Library source "${source}" at "${path.relative(assetLibraryRoot(), candidate)}".`,
            );
            break;
          }
          if (resolveAssetSource(source) !== filename) continue;
        }
      }
      throw new Error(
        `Cannot read Asset Library source "${source}". No verified moved source was found. Download it in Finder if iCloud has offloaded it, or set ASSET_LIBRARY_ROOT. Existing outputs were preserved.`,
        { cause },
      );
    }
  }
}
