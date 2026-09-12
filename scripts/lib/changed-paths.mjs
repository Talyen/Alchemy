import { spawnSync } from "node:child_process";
import path from "node:path";
import { expandRepositoryPaths } from "./repository-paths.mjs";
import { readFileSync } from "node:fs";

import { changedGitPaths } from "./current-run.mjs";
import { resolveRoutes, SHARED_BUILD_PATTERNS } from "./change-routes.mjs";
import { globToRegExp } from "./glob-pattern.mjs";

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

export function resolveSelectedPaths(rootDir, { paths }) {
  let selected = paths.length > 0 ? paths : changedGitPaths(rootDir);
  if (!selected) throw new Error("git status failed");
  if (paths.length === 0 && selected.length === 0) {
    const committed = spawnSync(
      "git",
      ["diff-tree", "--root", "-m", "--no-renames", "--no-commit-id", "--name-only", "-z", "-r", "HEAD"],
      {
        cwd: rootDir,
        encoding: "utf8",
      },
    );
    if (committed.status !== 0) throw new Error("Could not inspect HEAD changes");
    selected = [...new Set(committed.stdout.split("\0").filter(Boolean))];
  }
  return expandRepositoryPaths(rootDir, selected);
}

/** Select the actual updates supplied by Git's pre-push hook, including deletions/renames. */
export function resolvePushPaths(rootDir, input) {
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
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
  return [...paths].sort();
}

function isDocumentationPath(filePath) {
  return filePath.endsWith(".md") || /^(docs|\.agents|\.cursor)\//u.test(filePath);
}

export function classifyCheckPaths(paths) {
  paths = expandRepositoryPaths(path.resolve(import.meta.dirname, "../.."), paths).filter(
    (filePath) => !isDocumentationPath(filePath),
  );
  const routes = resolveRoutes(paths);
  const ids = new Set(routes.map((route) => route.id));
  const needsCodeChecks = paths.length > 0;
  const lockfile = paths.some((filePath) => filePath === "package.json" || filePath === "package-lock.json");
  const sharedBuild = paths.some((filePath) =>
    SHARED_BUILD_PATTERNS.some((pattern) => globToRegExp(pattern).test(filePath)),
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
