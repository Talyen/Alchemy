import path from "node:path";

/**
 * @param {string} filename
 * @param {string} [cwd]
 * @returns {string}
 */
export function repoRelativePosix(filename, cwd = process.cwd()) {
  const absolute = path.resolve(filename).replaceAll("\\", "/");
  const root = path.resolve(cwd).replaceAll("\\", "/");
  if (absolute === root) return "";
  if (absolute.startsWith(`${root}/`)) return absolute.slice(root.length + 1);
  return absolute.replace(/^\.\//u, "");
}
