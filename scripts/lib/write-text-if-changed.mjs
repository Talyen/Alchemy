import { readFile, writeFile } from "node:fs/promises";

/**
 * Write text only when content differs from the existing file.
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>} true if the file was written
 */
export async function writeTextIfChanged(filePath, content) {
  try {
    const existing = await readFile(filePath, "utf8");
    if (existing === content) {
      return false;
    }
  } catch {
    // File missing — write below.
  }
  await writeFile(filePath, content, "utf8");
  return true;
}
