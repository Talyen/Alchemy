import { resolveRoutes } from "./change-routes.mjs";

/**
 * @param {string} filePath
 * @param {string} [rootDir]
 * @returns {string}
 */
function repoRelativePath(filePath, rootDir = process.cwd()) {
  const normalized = filePath.replaceAll("\\", "/");
  const root = rootDir.replaceAll("\\", "/");
  if (normalized === root) return "";
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
  return normalized.replace(/^\.\//u, "");
}

/**
 * @param {string} filePath
 * @param {string} [rootDir]
 * @returns {{ routes: string[], focusedE2E: string[] }}
 */
export function routeHintForPath(filePath, rootDir = process.cwd()) {
  const relative = repoRelativePath(filePath, rootDir);
  const routes = resolveRoutes([relative]).map((route) => route.id);
  /** @type {string[]} */
  const focusedE2E = [];
  if (routes.includes("save")) focusedE2E.push("save");
  return { routes, focusedE2E };
}

/**
 * @param {{ routes: string[], focusedE2E: string[] }} hint
 * @returns {string}
 */
export function formatRouteHintLine(hint) {
  if (hint.routes.length === 0) return "";
  const parts = [`routes: ${hint.routes.join(", ")}`];
  if (hint.focusedE2E.length > 0) {
    parts.push(`CI focused E2E: ${hint.focusedE2E.join(", ")}`);
  }
  return parts.join(" · ");
}
