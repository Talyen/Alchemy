// Content-hash freshness for asset optimization pipelines.
// An output is fresh iff it exists and its manifest entry matches a hash of
// source bytes + transformation settings + schema version salt.
// Manifest entries also store source mtimeMs + size so unchanged files can
// skip re-reading/re-hashing when the filesystem fingerprint matches.
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";

import { writeTextIfChanged } from "./write-text-if-changed.mjs";

/**
 * @typedef {{ hash: string, mtimeMs: number, size: number }} ManifestEntry
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

  if (
    storedEntry &&
    typeof storedEntry.hash === "string" &&
    storedEntry.mtimeMs === mtimeMs &&
    storedEntry.size === size
  ) {
    return { hash: storedEntry.hash, mtimeMs, size };
  }

  const hash = await computeContentHash(sourcePath, settings, schemaVersion);
  return { hash, mtimeMs, size };
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
