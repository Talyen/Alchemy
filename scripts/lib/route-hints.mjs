import { E2E_ESCALATIONS, E2E_NAMES, resolveRoutes } from "./change-routes.mjs";

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
  const add = (name) => {
    if (!focusedE2E.includes(name)) focusedE2E.push(name);
  };
  for (const id of routes) {
    if (id === "shop" || id === "shop-screen") add("shop");
    else if (Object.hasOwn(E2E_ESCALATIONS, id)) add(id);
    else if (E2E_NAMES.has(id)) add(id);
  }
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
