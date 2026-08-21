import { readFile, writeFile } from "node:fs/promises";

/**
 * Write text only when content differs from the existing file.
 * @param {string} filePath
 * @param {string} content
 * @param {{ check?: boolean }} [options]
 * @returns {Promise<boolean>} true if the file was written
 */
export async function writeTextIfChanged(filePath, content, options = {}) {
  const { check = false } = options;
  let existing;
  try {
    existing = await readFile(filePath, "utf8");
  } catch {
    // File missing — write below.
  }

  if (existing === content) return false;
  if (check) throw new Error(`Generated file is stale: ${filePath}`);

  await writeFile(filePath, content, "utf8");
  return true;
}
