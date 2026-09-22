import { expandRepositoryPaths, runGit } from "../repository-paths.mjs";
import { readFileSync } from "node:fs";

import { changedGitPaths } from "./current-run.mjs";
import { isDocumentationPath, resolveRoutes, SHARED_BUILD_PATTERNS } from "./change-routes.mjs";
import { globToRegExp } from "../glob-pattern.mjs";

const COMPILED_SHARED_BUILD_PATTERNS = SHARED_BUILD_PATTERNS.map(globToRegExp);

export function parseChangedPathsArgs(argv, { usage } = {}) {
  const flags = new Set();
  const paths = [];
  let filePaths;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--paths-file") {
      const filename = argv[++index];
      if (!filename || filename.startsWith("--") || filePaths) throw new Error("--paths-file requires one filename");
      filePaths = JSON.parse(readFileSync(filename, "utf8"));
      if (!Array.isArray(filePaths) || !filePaths.length || filePaths.some((file) => typeof file !== "string" || !file))
        throw new Error("Path selection file must contain a non-empty JSON array of paths");
      continue;
    }
    if (arg === "--") continue;
    if (arg.startsWith("--")) flags.add(arg.slice(2));
    else paths.push(arg);
  }
  if (filePaths && (paths.length || flags.has("diff")))
    throw new Error("Choose a path selection file, explicit paths, or --diff");
  if (filePaths) paths.push(...filePaths);
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  if (paths.length === 0 && !flags.has("diff")) {
    throw new Error(usage ?? "Provide paths or use --diff.");
  }
  return { flags, paths };
}

/**
 * Tracked changes against HEAD (staged and unstaged) plus untracked files, so
 * new sources stay covered while committed history is ignored. Renames are
 * listed as delete + add so both paths keep their risk selection.
 */
function diffHeadPaths(rootDir) {
  const tracked = runGit(rootDir, ["diff", "HEAD", "--no-renames", "--name-only", "-z", "--"]);
  const untracked = runGit(rootDir, ["ls-files", "--others", "--exclude-standard", "-z"]);
  if (tracked.status !== 0 || untracked.status !== 0) return null;
  return [...new Set([...tracked.stdout.split("\0"), ...untracked.stdout.split("\0")].filter(Boolean))];
}

export function resolveSelectedPaths(rootDir, { flags, paths }) {
  const useDiff = flags?.has("diff") ?? false;
  let selected = paths.length > 0 ? paths : useDiff ? diffHeadPaths(rootDir) : changedGitPaths(rootDir);
  if (!selected) throw new Error(useDiff ? "git diff failed" : "git status failed");
  if (paths.length === 0 && selected.length === 0) {
    const committed = runGit(rootDir, [
      "diff-tree",
      "--root",
      "-m",
      "--no-renames",
      "--no-commit-id",
      "--name-only",
      "-z",
      "-r",
      "HEAD",
    ]);
    if (committed.status !== 0) throw new Error("Could not inspect HEAD changes");
    selected = [...new Set(committed.stdout.split("\0").filter(Boolean))];
  }
  return expandRepositoryPaths(rootDir, selected);
}

/** Select the actual updates supplied by Git's pre-push hook, including deletions/renames. */
export function resolvePushPaths(rootDir, input) {
  const git = (args) => {
    const result = runGit(rootDir, args);
    if (result.status !== 0)
      throw new Error(`Could not inspect push revisions: ${result.error?.message ?? result.stderr}`);
    return result.stdout;
  };
  const paths = new Set();
  const head = git(["rev-parse", "HEAD"]).trim();
  for (const line of input.split(/\r?\n/u).filter(Boolean)) {
    const fields = line.trim().split(/\s+/u);
    const [localRef, localOid, , remoteOid] = fields;
    if (fields.length !== 4 || ![localOid, remoteOid].every((oid) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(oid)))
      throw new Error("Invalid pre-push input; expected Git ref and object ID pairs");
    if (/^0+$/u.test(localOid)) continue; // Deleting a remote ref ships no source.
    const commit = git(["rev-parse", `${localOid}^{commit}`]).trim();
    if (commit !== head)
      throw new Error(`Check out ${localRef} before pushing it so verification tests the outgoing source`);
    // A new remote ref has no base. Check its complete tree instead of guessing
    // an upstream or silently narrowing the first push to the latest commit.
    const output = /^0+$/u.test(remoteOid)
      ? git(["ls-tree", "-r", "--name-only", "-z", commit])
      : git(["diff", "--no-renames", "--name-only", "-z", remoteOid, commit, "--"]);
    for (const file of output.split("\0").filter(Boolean)) paths.add(file);
  }
  if (paths.size > 0 && git(["status", "--porcelain", "--untracked-files=all", "-z"]).length > 0)
    throw new Error("Pre-push verification requires a clean checkout. Commit or stash changes before pushing.");
  // Expand through the shared path owner like the non-push selection so both
  // return normalized repo-relative paths (deleted paths are retained).
  return expandRepositoryPaths(rootDir, [...paths].sort());
}

export function classifyCheckPaths(rootDir, paths) {
  const expanded = expandRepositoryPaths(rootDir, paths);
  const codePaths = expanded.filter((filePath) => !isDocumentationPath(filePath));
  const routes = resolveRoutes(codePaths.length > 0 ? codePaths : expanded);
  const ids = new Set(routes.map((route) => route.id));
  const needsCodeChecks = codePaths.length > 0;
  const lockfile = codePaths.some((filePath) => filePath === "package.json" || filePath === "package-lock.json");
  const sharedBuild = codePaths.some((filePath) =>
    COMPILED_SHARED_BUILD_PATTERNS.some((expression) => expression.test(filePath)),
  );
  const desktop = ids.has("desktop") || sharedBuild;
  const web =
    sharedBuild ||
    ids.has("runtime") ||
    ids.has("assets") ||
    codePaths.some((filePath) =>
      /^(src\/|public\/|index\.html$|vite\.config\.ts$|vercel\.json$|package\.json$|package-lock\.json$)/u.test(
        filePath,
      ),
    );
  return { needsCodeChecks, lockfile, desktop, web, routeIds: [...ids] };
}
