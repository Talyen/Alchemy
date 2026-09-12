#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractSubcommand, isDestructive } from "./lib/git-classify.mjs";

const ownShimDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "bin");

const args = process.argv.slice(2);
const { subcommand, subIndex } = extractSubcommand(args);
// Git resolves repeated -C and explicit work-tree/git-dir options itself.
// Use the identical prelude for inspection, backup, and the requested command.
const prelude = args.slice(0, Math.max(0, subIndex)).filter((arg) => arg !== "--");

function hasDirtyTree() {
  const result = spawnSync(realGit, [...prelude, "status", "--porcelain", "--untracked-files=all", "-z"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`Could not inspect the target checkout; command blocked. ${result.error?.message ?? result.stderr}`);
    process.exit(1);
  }
  return result.stdout.length > 0;
}

function stashBackup(cmd) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const msg = `auto-backup pre-${cmd} ${ts}`;
  const result = spawnSync(realGit, [...prelude, "stash", "push", "-m", msg, "--include-untracked"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return { msg, status: result.status, output: (result.stdout ?? "") + (result.stderr ?? "") };
}

function findRealGit() {
  if (process.env.REAL_GIT) return process.env.REAL_GIT;
  const which = spawnSync("bash", ["-lc", "which -a git 2>/dev/null | head -20"], { encoding: "utf8" });
  const candidates = (which.stdout ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => path.dirname(p) !== ownShimDir);
  if (candidates.length > 0) return candidates[0];
  return "git";
}

function execRealGit(realGit, gitArgs) {
  // Built-in commands take precedence over aliases; preserve caller Git config.
  const result = spawnSync(realGit, gitArgs, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}

const realGit = findRealGit();

if (!isDestructive(args)) {
  execRealGit(realGit, args);
}

if (!hasDirtyTree()) {
  execRealGit(realGit, args);
}

const backup = stashBackup(subcommand || "destructive");
console.error("");
console.error("blocked: destructive git command with dirty tree");
console.error(`  attempted: git ${args.join(" ")}`);
if (prelude.length) console.error(`  Recovery commands below require the same Git options: ${prelude.join(" ")}`);
if (backup.status === 0) {
  console.error(`  backup: git stash push -m "${backup.msg}" --include-untracked`);
} else {
  console.error(`  backup FAILED (exit ${backup.status}): git stash push -m "${backup.msg}" --include-untracked`);
  console.error("  Your work was NOT automatically saved — stash failed. Commit or stash manually before retrying.");
}
if (backup.output.trim()) console.error(backup.output.trim());
console.error("");
if (backup.status === 0) {
  console.error("  Your work was stashed, not lost. Recover with:");
  console.error("    git stash list");
  console.error(`    git stash show -p stash@{0}   # inspect`);
  console.error(`    git stash apply stash@{0}     # restore without dropping the backup`);
  console.error(`    git stash drop stash@{0}      # only after verifying the restore`);
} else {
  console.error("  Manual recovery — check git status and create a backup:");
  console.error("    git status");
  console.error('    git stash push -m "manual-backup" --include-untracked');
}
console.error("  Or review recent HEAD moves:");
console.error("    git reflog | head -20");
console.error("");
console.error("  To retry after stashing/committing, run the same git command again on a clean tree.");
console.error("  If you have parallel agents, use isolated worktrees instead:");
console.error("    node scripts/agent-worktree.mjs create --task <slug>");
console.error("  Detached verification (consolidated):");
console.error("    node scripts/agent-worktree.mjs create --task <slug> --detached");
console.error("");
process.exit(1);
