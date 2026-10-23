import { expandRepositoryPaths, runGit } from "../repository-paths.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function parseChangedPathsArgs(argv, { usage } = {}) {
  const flags = new Set();
  const paths = [];
  let filePaths;
  let revision;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--committed") {
      revision = argv[++index];
      if (!revision || revision.startsWith("-") || flags.has("committed"))
        throw new Error("--committed requires one Git revision");
      flags.add("committed");
      continue;
    }
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
  if (flags.has("committed") && (paths.length || filePaths || flags.has("diff")))
    throw new Error("Choose explicit paths, --diff, or --committed <revision>");
  if (flags.has("task") && (paths.length || filePaths || flags.has("diff") || flags.has("committed")))
    throw new Error("Choose --task, explicit paths, --diff, or --committed <revision>");
  if (
    flags.has("all") &&
    (paths.length || filePaths || flags.has("task") || flags.has("diff") || flags.has("committed"))
  )
    throw new Error("Choose --all or a task/path selection");
  if (filePaths && (paths.length || flags.has("diff")))
    throw new Error("Choose a path selection file, explicit paths, or --diff");
  if (filePaths) paths.push(...filePaths);
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  if (paths.length === 0 && !flags.has("diff") && !flags.has("committed") && !flags.has("task") && !flags.has("all")) {
    throw new Error(usage ?? "Provide paths or use --diff.");
  }
  return { flags, paths, revision };
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

function taskSelectionBase(rootDir) {
  const branch = runGit(rootDir, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (branch.status !== 0) throw new Error("--task requires a task branch, not detached HEAD");
  const name = branch.stdout.trim();
  if (name === "main") throw new Error("--task requires an isolated task checkout; use explicit paths on main");
  const base = runGit(rootDir, ["config", "--local", "--get", `branch.${name}.alchemyTaskBase`]);
  const commit = base.stdout.trim();
  if (base.status !== 0 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit))
    throw new Error("No recorded task base. Use explicit paths, or create a task with agent-worktree.mjs create");
  if (runGit(rootDir, ["merge-base", "--is-ancestor", commit, "HEAD"]).status !== 0)
    throw new Error("Recorded task base is not an ancestor of HEAD; inspect branch history before checking");
  return commit;
}

export function taskComparisonBase(rootDir) {
  taskSelectionBase(rootDir); // Original provenance must remain valid after merges.
  const base = runGit(rootDir, ["merge-base", "main", "HEAD"]);
  if (base.status !== 0 || !base.stdout.trim()) throw new Error("Could not compare task with local main");
  return base.stdout.trim();
}

export function resolveSelectedPaths(rootDir, { flags, paths, revision }) {
  const committed = flags?.has("committed");
  let selected;
  if (flags?.has("all")) {
    const inventory = runGit(rootDir, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
    if (inventory.status !== 0) throw new Error("Could not inspect repository files");
    selected = [...new Set(inventory.stdout.split("\0").filter(Boolean))].sort();
  } else if (flags?.has("task")) {
    const base = taskComparisonBase(rootDir);
    const committedPaths = runGit(rootDir, ["diff", "--no-renames", "--name-only", "-z", base, "HEAD", "--"]);
    const working = diffHeadPaths(rootDir);
    if (committedPaths.status !== 0 || !working) throw new Error("Could not inspect complete task changes");
    selected = [...new Set([...committedPaths.stdout.split("\0").filter(Boolean), ...working])].sort();
  } else if (committed) {
    const commit = runGit(rootDir, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`]);
    if (commit.status !== 0) throw new Error(`Unknown commit: ${revision}`);
    const result = runGit(rootDir, [
      "diff-tree",
      "--root",
      "-m",
      "--no-renames",
      "--no-commit-id",
      "--name-only",
      "-z",
      "-r",
      commit.stdout.trim(),
    ]);
    if (result.status !== 0) throw new Error(`Could not inspect commit: ${revision}`);
    selected = [...new Set(result.stdout.split("\0").filter(Boolean))];
  } else {
    selected = paths.length ? paths : diffHeadPaths(rootDir);
    if (!selected) throw new Error("git diff failed");
  }
  const expanded = expandRepositoryPaths(rootDir, selected);
  if (!committed)
    for (const file of expanded) {
      if (existsSync(path.join(rootDir, file))) continue;
      // Deleted tracked files and committed deletions remain selectable. A typo
      // has neither an index entry nor history and must never yield a green gate.
      const tracked = runGit(rootDir, ["ls-files", "--error-unmatch", "--", `:(literal)${file}`]);
      if (tracked.status === 0) continue;
      const history = runGit(rootDir, ["log", "-1", "--format=%H", "--", `:(literal)${file}`]);
      if (history.status !== 0 || !history.stdout.trim())
        throw new Error(`Selected path does not exist and is not a known deletion: ${file}`);
    }
  return expanded;
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
