#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), "..");
const WORKTREE_ROOT = path.join(root, ".worktrees");
const UNCACHED_GIT_OPTIONS = ["-c", "core.untrackedCache=false", "-c", "core.fsmonitor=false"];
const UNFINISHED_GIT_STATES = [
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "BISECT_START",
  "rebase-merge",
  "rebase-apply",
];

// Creation and recovery work from a copied single file in minimal checkouts.
// Integration loads the merged task's command launcher only for verification.
function isMainEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(path.resolve(currentFile));
  } catch {
    return path.resolve(entry) === path.resolve(currentFile);
  }
}

function runGit(args, opts = {}) {
  const result = spawnSync("git", [...UNCACHED_GIT_OPTIONS, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: opts.stdio ?? "pipe",
  });
  return result;
}

// Stage the checkout for rollback if unregistration fails. Successful cleanup
// deletes the complete checkout, including local-only files, and retains its branch.
export function removeIntegratedWorktree(main, task, branch, head) {
  const git = (...args) =>
    execFileSync("git", [...UNCACHED_GIT_OPTIONS, ...args], { cwd: main, encoding: "utf8" }).trim();
  if (task === main || fs.lstatSync(task).isSymbolicLink()) throw new Error("Unexpected task checkout");
  const records = git("worktree", "list", "--porcelain", "-z").split("\0\0");
  const record = records.find((entry) => entry.split("\0").includes("worktree " + task));
  if (
    !record?.split("\0").includes("branch refs/heads/" + branch) ||
    record.split("\0").some((field) => /^(locked|prunable)( |$)/.test(field))
  )
    throw new Error("Task worktree registration changed or is locked");
  if (
    git("-C", task, "branch", "--show-current") !== branch ||
    git("-C", task, "rev-parse", "HEAD") !== head ||
    git("rev-parse", "main") !== head
  )
    throw new Error("Task or main changed after integration");
  if (git("-C", task, "status", "--porcelain", "--untracked-files=all")) throw new Error("Unfinished work preserved");
  for (const state of UNFINISHED_GIT_STATES)
    if (fs.existsSync(git("-C", task, "rev-parse", "--path-format=absolute", "--git-path", state)))
      throw new Error("Unfinished Git operation preserved");
  if (/^160000 /m.test(git("-C", task, "ls-files", "--stage"))) throw new Error("Submodule worktree preserved");
  const root = path.resolve(
    process.env.CODEX_WORKTREE_ARCHIVE_ROOT ??
      path.join(os.homedir(), ".codex", "worktree-archives", path.basename(main)),
  );
  if (
    [main, task, git("rev-parse", "--path-format=absolute", "--git-common-dir")].some(
      (parent) => root === parent || root.startsWith(parent + path.sep),
    )
  )
    throw new Error("Recovery directory must be outside the repository and task checkout");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const recovery = fs.mkdtempSync(path.join(root, branch.replaceAll("/", "-") + "-"));
  const checkout = path.join(recovery, "checkout");
  fs.writeFileSync(path.join(recovery, "recovery.json"), JSON.stringify({ main, task, branch, head }, null, 2));
  process.chdir(main);
  fs.renameSync(task, checkout);
  try {
    git("worktree", "remove", task); // Missing original path: unregister only this entry, without --force.
  } catch (error) {
    if (!fs.existsSync(task)) fs.renameSync(checkout, task);
    throw error;
  }
  fs.unlinkSync(path.join(checkout, ".git"));
  fs.rmSync(recovery, { recursive: true });
  console.log("Removed completed worktree " + task + ", including local-only files; retained branch " + branch);
}

function usage() {
  console.log(`Usage:
  node scripts/agent-worktree.mjs create --task <slug> [--base <branch>] [--detached]
  node scripts/agent-worktree.mjs integrate --task <slug> [--keep-worktree]
  node scripts/agent-worktree.mjs remove --task <slug> [--force]
  node scripts/agent-worktree.mjs list
  node scripts/agent-worktree.mjs prune

Creates isolated worktrees under .worktrees/<slug> on branch agent/<slug>.
Use one worktree per implementation chat to avoid shared-checkout races.
Add --detached for verification-only detached HEAD.
`);
}

export function slugify(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function linkDependencies(mainRoot, targetWorktree) {
  const rootNodeModules = path.join(mainRoot, "node_modules");
  const targetNodeModules = path.join(targetWorktree, "node_modules");
  if (fs.existsSync(rootNodeModules) && !fs.existsSync(targetNodeModules)) {
    try {
      fs.symlinkSync(path.relative(targetWorktree, rootNodeModules), targetNodeModules, "junction");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;

  if (["create", "integrate", "remove", "list", "prune"].includes(cmd)) {
    const valueOptions =
      cmd === "create" ? ["--task", "--base"] : ["remove", "integrate"].includes(cmd) ? ["--task"] : [];
    const flagOptions =
      cmd === "create"
        ? ["--detached"]
        : cmd === "remove"
          ? ["--force"]
          : cmd === "integrate"
            ? ["--keep-worktree"]
            : [];
    const seen = new Set();
    for (let index = 0; index < rest.length; index++) {
      const arg = rest[index];
      const equals = arg.indexOf("=");
      const name = equals < 0 ? arg : arg.slice(0, equals);
      if (seen.has(name) || (!valueOptions.includes(name) && !flagOptions.includes(arg))) {
        console.error(`Unknown or repeated option: ${arg}`);
        process.exit(2);
      }
      seen.add(name);
      if (valueOptions.includes(name)) {
        const value = equals < 0 ? rest[++index] : arg.slice(equals + 1);
        if (!value || value.startsWith("-")) {
          console.error(`${name} requires a value`);
          process.exit(2);
        }
      }
    }
  }

  function getArg(name) {
    const prefix = `${name}=`;
    for (let index = 0; index < rest.length; index++) {
      if (rest[index] === name) return rest[index + 1] ?? null;
      if (rest[index].startsWith(prefix)) return rest[index].slice(prefix.length) || null;
    }
    return null;
  }

  function hasFlag(name) {
    return rest.includes(name);
  }

  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
    process.exit(0);
  }

  if (cmd === "list") {
    const r = runGit(["worktree", "list"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }

  if (cmd === "prune") {
    const r = runGit(["worktree", "prune", "-v"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }

  if (cmd === "integrate") {
    const task = slugify(getArg("--task") ?? "");
    if (!task) throw new Error("missing or invalid --task slug");
    const git = (cwd, args, raw = false) => {
      const result = spawnSync("git", [...UNCACHED_GIT_OPTIONS, ...args], { cwd, encoding: "utf8" });
      if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
      return raw ? result.stdout : result.stdout.trim();
    };
    const common = fs.realpathSync(path.resolve(root, git(root, ["rev-parse", "--git-common-dir"])));
    // The OS releases this shared lock when its owner exits, including crashes.
    // Hash collisions fail closed as busy; they never allow concurrent integration.
    const port = 20000 + (createHash("sha256").update(common).digest().readUInt32BE(0) % 40000);
    const { acquireExclusivePort } = await import("./lib/exclusive-port.mjs");
    const lock = await acquireExclusivePort(port, { label: "Integration lock" });
    try {
      const records = git(root, ["worktree", "list", "--porcelain", "-z"], true).split("\0\0");
      const mainRecord = records.find((record) => record.split("\0").includes("branch refs/heads/main"));
      if (!mainRecord) throw new Error("main must have a registered checkout; nothing integrated.");
      const mainPath = mainRecord.split("\0")[0].slice("worktree ".length);
      const taskPath = path.join(mainPath, ".worktrees", task);
      const taskRecord = records.find((record) => record.split("\0").includes(`worktree ${taskPath}`));
      if (!taskRecord?.split("\0").includes(`branch refs/heads/agent/${task}`)) {
        throw new Error("Task must be a registered worktree on its expected agent branch.");
      }
      const clean = (cwd, branch) => {
        if (git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) !== branch) {
          throw new Error(`Checkout is no longer on its expected branch ${branch}: ${cwd}; nothing integrated.`);
        }
        if (git(cwd, ["status", "--porcelain", "--untracked-files=all"])) {
          throw new Error(`Checkout has uncommitted work: ${cwd}; preserve it and retry later.`);
        }
        for (const marker of UNFINISHED_GIT_STATES) {
          if (fs.existsSync(path.resolve(cwd, git(cwd, ["rev-parse", "--git-path", marker])))) {
            throw new Error(`Unfinished Git operation in ${cwd}; resolve it before integration.`);
          }
        }
      };
      clean(mainPath, "main");
      clean(taskPath, `agent/${task}`);
      const mainHead = git(mainPath, ["rev-parse", "HEAD"]);
      git(taskPath, [
        "merge",
        "--no-edit",
        "-m",
        "chore: incorporate main before integration\n\nUser-Facing: no",
        mainHead,
      ]);
      const taskHead = git(taskPath, ["rev-parse", "HEAD"]);
      const paths = git(taskPath, ["diff", "--no-renames", "--name-only", "-z", mainHead, taskHead], true)
        .split("\0")
        .filter(Boolean);
      if (paths.length) {
        const { commandInvocation } = await import(
          pathToFileURL(path.join(taskPath, "scripts/lib/command-invocation.mjs")).href
        );
        const check = (args) => {
          const result = spawnSync(...commandInvocation("npm", args), {
            cwd: taskPath,
            stdio: "inherit",
          });
          if (result.status !== 0) throw new Error("Integration verification failed; main remains unchanged.");
        };
        check(["run", "check", "--", ...paths]);
      }
      clean(taskPath, `agent/${task}`);
      clean(mainPath, "main");
      if (git(taskPath, ["rev-parse", "HEAD"]) !== taskHead || git(mainPath, ["rev-parse", "HEAD"]) !== mainHead) {
        throw new Error("A checkout changed during verification; retry integration.");
      }
      git(mainPath, ["merge", "--ff-only", taskHead]);
      console.log(`Integrated ${task} into local main at ${taskHead}; no push performed.`);
      if (!hasFlag("--keep-worktree")) removeIntegratedWorktree(mainPath, taskPath, `agent/${task}`, taskHead);
    } finally {
      await lock.release();
    }
    return;
  }

  if (cmd === "create") {
    const taskRaw = getArg("--task");
    if (!taskRaw) {
      console.error("missing --task <slug>");
      usage();
      process.exit(1);
    }
    const task = slugify(taskRaw);
    if (!task) {
      console.error("invalid --task slug");
      process.exit(1);
    }
    const detached = hasFlag("--detached");
    const base = getArg("--base") ?? "main";
    const worktreePath = path.join(WORKTREE_ROOT, task);
    const branch = `agent/${task}`;

    // Branch names and worktree directories live on disk: `Task` and `task`
    // would collide on case-insensitive filesystems, so reject the second
    // spelling explicitly instead of corrupting the first checkout. This runs
    // before the exact-exists check so the collision reports on every platform.
    if (fs.existsSync(WORKTREE_ROOT)) {
      const clash = fs
        .readdirSync(WORKTREE_ROOT)
        .find((entry) => entry !== task && entry.toLowerCase() === task.toLowerCase());
      if (clash) {
        console.error(`worktree slug ${task} collides with existing ${clash}; choose another --task`);
        process.exit(1);
      }
    }

    if (fs.existsSync(worktreePath)) {
      console.error(`worktree already exists: ${worktreePath}`);
      console.error(`remove with: node scripts/agent-worktree.mjs remove --task ${task}`);
      process.exit(1);
    }

    fs.mkdirSync(WORKTREE_ROOT, { recursive: true });

    if (detached) {
      const args = ["worktree", "add", "--detach", worktreePath, base];
      console.log(`▸ git ${args.join(" ")}`);
      const r = runGit(args, { stdio: "inherit" });
      if (r.status !== 0) process.exit(r.status ?? 1);
      const linked = linkDependencies(root, worktreePath);
      console.log(`detached worktree ready: ${worktreePath} at ${base} (verification only)`);
      console.log(`  cd "${worktreePath}"`);
      if (linked) {
        console.log("  node_modules linked from root checkout");
      } else {
        console.log("  npm ci  # install dependencies before verification");
      }
      console.log(`  cd "${root}"  # return before cleanup`);
      console.log(`  node scripts/agent-worktree.mjs remove --task ${task}  # after verification`);
      process.exit(0);
    }

    const branchExists = runGit(["show-ref", "--verify", `refs/heads/${branch}`]);

    const args =
      branchExists.status === 0
        ? ["worktree", "add", worktreePath, branch]
        : ["worktree", "add", "-b", branch, worktreePath, base];

    console.log(`▸ git ${args.join(" ")}`);
    const r = runGit(args, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
    const linked = linkDependencies(root, worktreePath);
    console.log(`worktree ready: ${worktreePath} on ${branch} (base ${base})`);
    console.log(`  cd "${worktreePath}"  # work in isolation`);
    if (linked) {
      console.log("  node_modules linked from root checkout");
    } else {
      console.log("  npm ci  # install dependencies before verification");
    }
    console.log(`  cd "${root}"  # return before cleanup`);
    console.log(`  node scripts/agent-worktree.mjs remove --task ${task}  # after merging to main`);
    process.exit(0);
  }

  if (cmd === "remove") {
    const taskRaw = getArg("--task");
    if (!taskRaw) {
      console.error("missing --task <slug>");
      usage();
      process.exit(1);
    }
    const task = slugify(taskRaw);
    if (!task) {
      console.error("invalid --task slug");
      process.exit(1);
    }
    const worktreePath = path.join(WORKTREE_ROOT, task);
    const branch = `agent/${task}`;
    const force = hasFlag("--force");

    const list = runGit(["worktree", "list", "--porcelain", "-z"]);
    if (list.status !== 0) {
      console.error("Could not inspect registered worktrees; nothing removed.");
      process.exit(list.status ?? 1);
    }
    const isRegistered = (list.stdout ?? "").split("\0").includes(`worktree ${worktreePath}`);

    if (isRegistered) {
      const args = ["worktree", "remove", worktreePath];
      if (force) args.push("--force");
      console.log(`▸ git ${args.join(" ")}`);
      const r = runGit(args, { stdio: "inherit" });
      if (r.status !== 0) process.exit(r.status ?? 1);
    } else if (fs.existsSync(worktreePath)) {
      if (!force) {
        console.error(`Unregistered directory: ${worktreePath}. Inspect it before using --force to remove it.`);
        process.exit(1);
      }
      console.log(`worktree not registered, removing directory ${worktreePath}`);
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } else {
      console.log(`no worktree at ${worktreePath}`);
    }

    const branchExists = runGit(["show-ref", "--verify", `refs/heads/${branch}`]);
    if (branchExists.status === 0) {
      const del = runGit(["branch", force ? "-D" : "-d", branch], { stdio: "inherit" });
      if (del.status !== 0 && !force) {
        console.error(`branch ${branch} not fully merged; use --force to delete`);
        process.exit(del.status ?? 1);
      }
    }

    const prune = runGit(["worktree", "prune"], { stdio: "inherit" });
    process.exit(prune.status ?? 1);
  }

  console.error(`unknown command: ${cmd}`);
  usage();
  process.exit(1);
}

if (isMainEntry()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
