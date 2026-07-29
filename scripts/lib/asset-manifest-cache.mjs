// Content-hash freshness for asset optimization pipelines.
// An output is fresh iff it exists and its manifest entry matches a hash of
// source bytes + transformation settings + schema version salt.
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";

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
 * @param {string} manifestPath
 * @returns {Promise<Record<string, string>>}
 */
export async function loadManifest(manifestPath) {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      /** @type {Record<string, string>} */
      const entries = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          entries[key] = value;
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
 * @param {string | undefined} storedHash
 * @param {string} expectedHash
 * @returns {Promise<boolean>}
 */
export async function isOutputFresh(outputPath, storedHash, expectedHash) {
  if (!storedHash || storedHash !== expectedHash) {
    return false;
  }
  return pathExists(outputPath);
}

/**
 * Build a sorted manifest containing only the provided entries.
 * @param {Record<string, string>} entries
 * @returns {Record<string, string>}
 */
function sortManifest(entries) {
  /** @type {Record<string, string>} */
  const sorted = {};
  for (const key of Object.keys(entries).sort()) {
    sorted[key] = entries[key];
  }
  return sorted;
}

/**
 * Write the manifest only when serialized content changed.
 * @param {string} manifestPath
 * @param {Record<string, string>} entries
 * @returns {Promise<boolean>} true if the file was written
 */
export async function writeManifestIfChanged(manifestPath, entries) {
  const sorted = sortManifest(entries);
  const content = `${JSON.stringify(sorted, null, 2)}\n`;
  try {
    const existing = await readFile(manifestPath, "utf8");
    if (existing === content) {
      return false;
    }
  } catch {
    // File missing — write below.
  }
  await writeFile(manifestPath, content, "utf8");
  return true;
}
