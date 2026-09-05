import { spawnSync } from "node:child_process";

import { changedGitPaths } from "./current-run.mjs";
import { resolveRoutes } from "./change-routes.mjs";

export function parseChangedPathsArgs(argv, { usage } = {}) {
  const flags = new Set();
  const paths = [];
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg.startsWith("--")) flags.add(arg.slice(2));
    else paths.push(arg);
  }
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  if (paths.length === 0 && !flags.has("diff")) {
    throw new Error(usage ?? "Provide paths or use --diff.");
  }
  return { flags, paths };
}

export function resolveSelectedPaths(rootDir, { paths }) {
  let selected = paths.length > 0 ? paths : changedGitPaths(rootDir);
  if (!selected) throw new Error("git status failed");
  if (paths.length === 0 && selected.length === 0) {
    const committed = spawnSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
    });
    if (committed.status === 0)
      selected = committed.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
  }
  return selected;
}

function isDocumentationPath(filePath) {
  return filePath.endsWith(".md") || /^(docs|\.agents|\.cursor)\//u.test(filePath);
}

export function classifyCheckPaths(paths) {
  const routes = resolveRoutes(paths);
  const ids = new Set(routes.map((route) => route.id));
  const needsCodeChecks = paths.some((filePath) => !isDocumentationPath(filePath));
  const lockfile = paths.some((filePath) => filePath === "package.json" || filePath === "package-lock.json");
  const sharedBuild = paths.some((filePath) =>
    /^(package(?:-lock)?\.json$|tsconfig.*\.json$|vite\.config\.ts$|scripts\/build-verified\.mjs$|scripts\/lib\/(?:vite-.*|sentry-release)\.mjs$)/u.test(
      filePath,
    ),
  );
  const desktop = ids.has("desktop") || sharedBuild;
  const web =
    sharedBuild ||
    ids.has("runtime") ||
    ids.has("assets") ||
    paths.some((filePath) =>
      /^(src\/|public\/|index\.html$|vite\.config\.ts$|vercel\.json$|package\.json$|package-lock\.json$)/u.test(
        filePath,
      ),
    );
  return { needsCodeChecks, executable: needsCodeChecks, lockfile, desktop, web, routeIds: [...ids] };
}
