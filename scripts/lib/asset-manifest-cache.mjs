// Content-hash freshness for asset optimization pipelines.
// An output is fresh iff it exists and its manifest entry matches a hash of
// source bytes + transformation settings + schema version salt.
// Manifest entries also store source mtimeMs + size so unchanged files can
// skip re-reading/re-hashing when the filesystem fingerprint matches.
import { createHash } from "node:crypto";
import { access, readFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { writeTextIfChanged } from "./write-text-if-changed.mjs";
import { mapPool } from "./map-pool.mjs";

/**
 * @typedef {{ hash: string, mtimeMs: number, size: number, settingsSig?: string, owner?: string }} ManifestEntry
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return sorted;
  }
  return value;
}

function settingsSignature(settings, schemaVersion) {
  const hash = createHash("sha256");
  hash.update(String(schemaVersion));
  hash.update("\0");
  hash.update(JSON.stringify(canonicalize(settings)));
  return hash.digest("hex").slice(0, 16);
}

/**
 * @param {string} sourcePath
 * @param {Record<string, unknown>} settings
 * @param {string | number} schemaVersion
 * @returns {Promise<string>}
 */
export async function computeContentHash(sourcePath, settings, schemaVersion) {
  const sourceBytes = await readFile(sourcePath);
  const hash = createHash("sha256");
  hash.update(String(schemaVersion));
  hash.update("\0");
  hash.update(JSON.stringify(canonicalize(settings)));
  hash.update("\0");
  hash.update(sourceBytes);
  return hash.digest("hex").slice(0, 16);
}

/**
 * Resolve a content hash for a source file, reusing a stored hash when the
 * source mtimeMs + size still match (avoids reading file bytes).
 *
 * @param {string} sourcePath
 * @param {Record<string, unknown>} settings
 * @param {string | number} schemaVersion
 * @param {ManifestEntry | undefined} storedEntry
 * @returns {Promise<ManifestEntry>}
 */
export async function resolveSourceHash(sourcePath, settings, schemaVersion, storedEntry) {
  const sourceStat = await stat(sourcePath);
  const mtimeMs = sourceStat.mtimeMs;
  const size = sourceStat.size;

  const settingsSig = settingsSignature(settings, schemaVersion);

  if (
    storedEntry &&
    typeof storedEntry.hash === "string" &&
    storedEntry.mtimeMs === mtimeMs &&
    storedEntry.size === size &&
    storedEntry.settingsSig === settingsSig
  ) {
    return { hash: storedEntry.hash, mtimeMs, size, settingsSig };
  }

  const hash = await computeContentHash(sourcePath, settings, schemaVersion);
  return { hash, mtimeMs, size, settingsSig };
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @returns {ManifestEntry | null}
 */
function parseManifestEntry(value) {
  if (typeof value === "string") {
    // Legacy string-only hashes — force a full re-hash next run.
    return { hash: value, mtimeMs: Number.NaN, size: Number.NaN };
  }
  if (value && typeof value === "object" && typeof (/** @type {Record<string, unknown>} */ (value).hash) === "string") {
    const record = /** @type {Record<string, unknown>} */ (value);
    return {
      hash: /** @type {string} */ (record.hash),
      mtimeMs: typeof record.mtimeMs === "number" ? record.mtimeMs : Number.NaN,
      size: typeof record.size === "number" ? record.size : Number.NaN,
      ...(typeof record.settingsSig === "string" ? { settingsSig: record.settingsSig } : {}),
      ...(typeof record.owner === "string" ? { owner: record.owner } : {}),
    };
  }
  return null;
}

/**
 * @param {string} manifestPath
 * @returns {Promise<Record<string, ManifestEntry>>}
 */
export async function loadManifest(manifestPath) {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      /** @type {Record<string, ManifestEntry>} */
      const entries = {};
      for (const [key, value] of Object.entries(parsed)) {
        const entry = parseManifestEntry(value);
        if (entry) {
          entries[key] = entry;
        }
      }
      return entries;
    }
  } catch {
    // Missing or invalid manifest — start fresh.
  }
  return {};
}

/**
 * @param {string} outputPath
 * @param {ManifestEntry | string | undefined} storedEntry
 * @param {string} expectedHash
 * @returns {Promise<boolean>}
 */
export async function isOutputFresh(outputPath, storedEntry, expectedHash) {
  const storedHash = typeof storedEntry === "string" ? storedEntry : storedEntry?.hash;
  if (!storedHash || storedHash !== expectedHash) {
    return false;
  }
  return pathExists(outputPath);
}

/**
 * Build a sorted manifest containing only the provided entries.
 * @param {Record<string, ManifestEntry>} entries
 * @returns {Record<string, ManifestEntry>}
 */
function sortManifest(entries) {
  /** @type {Record<string, ManifestEntry>} */
  const sorted = {};
  for (const key of Object.keys(entries).sort()) {
    const entry = entries[key];
    sorted[key] = {
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size,
      ...(typeof entry.settingsSig === "string" ? { settingsSig: entry.settingsSig } : {}),
      ...(typeof entry.owner === "string" ? { owner: entry.owner } : {}),
    };
  }
  return sorted;
}

/**
 * Write the manifest only when serialized content changed.
 * @param {string} manifestPath
 * @param {Record<string, ManifestEntry>} entries
 * @returns {Promise<boolean>} true if the file was written
 */
export async function writeManifestIfChanged(manifestPath, entries) {
  const sorted = sortManifest(entries);
  const content = `${JSON.stringify(sorted, null, 2)}\n`;
  return writeTextIfChanged(manifestPath, content);
}

/**
 * Delete files in a fully-managed output directory that are not current targets.
 * Only intended for directories where every tracked file is a pipeline output;
 * do not use on directories that also hold manually-curated files.
 *
 * @param {string} outputDir
 * @param {Set<string>} keepNames
 * @param {{ manifestBasename?: string, label?: string }} [options]
 * @returns {Promise<number>} number of files removed
 */
export async function removeOrphanOutputs(outputDir, keepNames, options = {}) {
  const { manifestBasename = "", label = "asset" } = options;
  let entries;
  try {
    entries = await readdir(outputDir);
  } catch {
    return 0;
  }

  let removed = 0;
  for (const name of entries) {
    if (manifestBasename && name === manifestBasename) continue;
    if (keepNames.has(name)) continue;
    await unlink(path.join(outputDir, name));
    removed += 1;
    console.log(`Removed orphan ${label}: ${name}`);
  }
  return removed;
}

/**
 * Process a set of manifest-backed files and write one normalized manifest.
 * The callback owns discovery and transformation behavior; this helper owns
 * freshness state, bounded concurrency, error normalization, and persistence.
 *
 * @template T
 * @template R
 * @param {{
 *   entries: T[],
 *   manifestPath: string,
 *   concurrency?: number,
 *   keyOf?: (entry: T) => string,
 *   processEntry: (entry: T, storedEntry: ManifestEntry | undefined) => Promise<R & { entry?: ManifestEntry | null }>,
 *   handleError?: (entry: T, error: unknown) => R & { entry?: ManifestEntry | null },
 * }} options
 * @returns {Promise<{ previousManifest: Record<string, ManifestEntry>, results: Array<R & { item: T, key: string, failed: boolean }>, nextManifest: Record<string, ManifestEntry>, failed: boolean }>}
 */
export async function processManifestEntries({
  entries,
  manifestPath,
  concurrency = 1,
  keyOf = (entry) => /** @type {{ target?: string }} */ (entry).target ?? String(entry),
  processEntry,
  handleError,
}) {
  const previousManifest = await loadManifest(manifestPath);
  const results = await mapPool(entries, concurrency, async (item) => {
    const key = keyOf(item);
    try {
      const result = await processEntry(item, previousManifest[key]);
      return { item, key, ...result, failed: false };
    } catch (error) {
      if (!handleError) throw error;
      return { item, key, ...handleError(item, error), failed: true };
    }
  });

  /** @type {Record<string, ManifestEntry>} */
  const nextManifest = {};
  for (const result of results) {
    if (!result.entry) continue;
    const previous = previousManifest[result.key];
    // Keep committed fingerprints stable across machines/CI checkouts when the
    // content hash is unchanged. Fresh checkouts rewrite source mtimes, which
    // would otherwise dirty .asset-hashes.json on every assets job run.
    if (
      previous &&
      previous.hash === result.entry.hash &&
      Number.isFinite(previous.mtimeMs) &&
      Number.isFinite(previous.size)
    ) {
      nextManifest[result.key] = previous;
    } else {
      nextManifest[result.key] = result.entry;
    }
  }
  await writeManifestIfChanged(manifestPath, nextManifest);

  return {
    previousManifest,
    results,
    nextManifest,
    failed: results.some((result) => result.failed),
  };
}
