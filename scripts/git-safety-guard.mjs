#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractSubcommand, isDestructive } from "./lib/git-classify.mjs";
import { UNCACHED_GIT_OPTIONS } from "./lib/repository-paths.mjs";

const ownShimDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "bin");

const args = process.argv.slice(2);
const { subcommand, subIndex } = extractSubcommand(args);
// Git resolves repeated -C and explicit work-tree/git-dir options itself.
// Use the identical prelude for inspection, backup, and the requested command.
const prelude = args.slice(0, Math.max(0, subIndex)).filter((arg) => arg !== "--");

function hasDirtyTree() {
  const result = spawnSync(
    realGit,
    [...prelude, ...UNCACHED_GIT_OPTIONS, "status", "--porcelain", "--untracked-files=all", "-z"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  if (result.status !== 0) {
    console.error(`Could not inspect the target checkout; command blocked. ${result.error?.message ?? result.stderr}`);
    process.exit(1);
  }
  return result.stdout.length > 0;
}

function checkoutRestoresPaths() {
  if (subcommand !== "checkout") return false;
  const checkoutArgs = args.slice(subIndex + 1);
  if (checkoutArgs.some((arg) => /^--pathspec-from-file(?:=|$)/u.test(arg) || arg === "--patch" || arg === "-p"))
    return true;
  if (checkoutArgs.some((arg) => /^-[^-]*[bB]/u.test(arg) || /^--orphan(?:=|$)/u.test(arg))) return false;
  const operands = [];
  for (let index = 0; index < checkoutArgs.length; index++) {
    const arg = checkoutArgs[index];
    if (arg === "--conflict") index++;
    else if (!arg.startsWith("-")) operands.push(arg);
  }
  if (!operands.length) return false;
  // A single operand can name a branch or a tracked path. Git prefers an
  // existing revision, even when a tracked file has the same name.
  const revision = spawnSync(realGit, [...prelude, "rev-parse", "--verify", "--quiet", `${operands[0]}^{commit}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (revision.status === 0) return operands.length > 1;
  const files = spawnSync(realGit, [...prelude, "ls-files", "-z", "--", ...operands], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (files.status !== 0) {
    console.error(`Could not inspect checkout paths; command blocked. ${files.error?.message ?? files.stderr}`);
    process.exit(1);
  }
  return files.stdout.length > 0;
}

function findRealGit() {
  if (process.env.REAL_GIT) return process.env.REAL_GIT;
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathDirs) {
    if (!dir) continue;
    const resolvedDir = path.resolve(dir);
    if (resolvedDir === ownShimDir) continue;
    for (const ext of extensions) {
      const candidate = path.join(resolvedDir, `git${ext}`);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore unreadable path entries
      }
    }
  }
  return "git";
}

function execRealGit(realGit, gitArgs) {
  // Built-in commands take precedence over aliases; preserve caller Git config.
  const result = spawnSync(realGit, gitArgs, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}

const realGit = findRealGit();

if (!isDestructive(args) && !checkoutRestoresPaths()) {
  execRealGit(realGit, args);
}

if (!hasDirtyTree()) {
  execRealGit(realGit, args);
}

console.error("blocked: destructive git command with dirty tree");
console.error(`  attempted: git ${args.join(" ")}`);
console.error("  Working files, index, branches and stashes are unchanged.");
console.error("  Inspect the selected checkout and preserve its work before an authorized retry.");
console.error("  For isolated work:");
console.error("    node scripts/agent-worktree.mjs create --task <slug>");
process.exit(1);
