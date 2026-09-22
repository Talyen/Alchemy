import { resolveRoutes } from "../verification/change-routes.mjs";
import { toRepoRelative } from "../repository-paths.mjs";

/**
 * @param {string} filePath
 * @param {string} [rootDir]
 * @returns {string}
 */
function repoRelativePath(filePath, rootDir = process.cwd()) {
  // The repository root itself maps to "" (not "."): expanding "." would
  // select the entire tree, while "" matches no route and stays "unknown".
  // Outside paths pass through so cross-checkout reports keep readable hints.
  const relative = toRepoRelative(rootDir, filePath, { onOutside: "keep-relative" });
  return relative === "." ? "" : relative;
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
