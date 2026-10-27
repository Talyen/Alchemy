#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
let root = path.resolve(path.dirname(currentFile), "..");
let WORKTREE_ROOT = path.join(root, ".worktrees");
const UNCACHED_GIT_OPTIONS = ["-c", "core.untrackedCache=false", "-c", "core.fsmonitor=false"];
const UNFINISHED_GIT_STATES = [
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "BISECT_START",
  "rebase-merge",
  "rebase-apply",
];

// Recovery commands remain usable from a copied single file. Creation loads
// only its dependency-free storage helper; integration loads the task launcher.
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
    input: opts.input,
  });
  return result;
}

function preserveIntegrationEvidence(main, task, branch, head) {
  const evidencePath = (relative) => {
    const source = path.resolve(task, relative);
    if (!source.startsWith(task + path.sep)) throw new Error("Evidence path leaves task checkout; preserved");
    // Never follow links into another checkout, including ancestors of a file.
    let ancestor = task;
    for (const segment of path.relative(task, source).split(path.sep)) {
      ancestor = path.join(ancestor, segment);
      if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink())
        throw new Error("Evidence symlink requires inspection; checkout preserved");
    }
    return source;
  };
  const pointer = evidencePath("reports/current-run.json");
  const run = fs.existsSync(pointer) ? JSON.parse(fs.readFileSync(pointer, "utf8")) : null;
  const selected = new Set(["reports"]);
  const ignored = execFileSync(
    "git",
    [...UNCACHED_GIT_OPTIONS, "ls-files", "--others", "--ignored", "--exclude-standard", "-z"],
    { cwd: task, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  )
    .split("\0")
    .filter(Boolean);
  // Dependencies and reproducible outputs can be rebuilt. Preserve every other
  // ignored file, including localization drafts and ad-hoc investigation notes.
  const disposable = (relative) =>
    /(?:^|\/)node_modules(?:\/|$)/u.test(relative) ||
    /^(?:\.cache|dist(?:-demo|-desktop)?|release-desktop(?:-demo)?|coverage|test-results|playwright-report|\.vite|\.worktrees)(?:\/|$)/u.test(
      relative,
    ) ||
    /^reports\/boss-lyrics\/venv(?:\/|$)/u.test(relative);
  for (const file of ignored) if (!disposable(file) && !file.startsWith("reports/")) selected.add(file);
  if (run) {
    if (!/^[a-z0-9-]+$/u.test(run.runId)) throw new Error("Invalid evidence run ID; checkout preserved");
    selected.add(`reports/runs/${run.runId}`);
    for (const artifact of run.artifacts ?? []) {
      // Reused verification can link a previous run. Preserve that bundle too.
      const bundle = /^reports\/runs\/[a-z0-9-]+(?:\/|$)/u.exec(artifact.path);
      selected.add(bundle ? bundle[0].replace(/\/$/u, "") : artifact.path);
    }
  }
  const candidates = [...new Set([...selected].map((relative) => path.relative(task, evidencePath(relative))))];
  const existing = candidates.filter(
    (relative) =>
      fs.existsSync(path.join(task, relative)) &&
      !candidates.some((parent) => parent !== relative && relative.startsWith(parent + path.sep)),
  );
  console.log(
    `Cleanup preview: close task browsers; preserve evidence without rebuildable dependencies and ${ignored.filter((file) => !disposable(file) && !file.startsWith("reports/")).length} other local files; remove ${task}; retain ${branch}. Omit finish to keep the checkout and browsers.`,
  );
  if (!existing.length) return null;
  let parent = main;
  for (const segment of ["reports", "integrations"]) {
    parent = path.join(parent, segment);
    if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error("Evidence destination is a symlink; checkout preserved");
    fs.mkdirSync(parent, { recursive: true });
  }
  const destination = fs.mkdtempSync(path.join(parent, `${branch.replaceAll("/", "-")}-${head.slice(0, 12)}-`));
  const copy = (source, target) => {
    if (disposable(path.relative(task, source).replaceAll(path.sep, "/"))) return;
    const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      for (const entry of fs.readdirSync(source)) copy(path.join(source, entry), path.join(target, entry));
    } else if (stat.isFile()) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Independent copy-on-write files save physical space where supported;
      // unsupported filesystems fall back to the ordinary copy operation.
      fs.copyFileSync(source, target, fs.constants.COPYFILE_FICLONE);
    } else throw new Error("Unsupported evidence entry; checkout preserved");
    fs.utimesSync(target, stat.atime, stat.mtime);
  };
  try {
    for (const relative of existing) copy(path.resolve(task, relative), path.resolve(destination, relative));
    fs.writeFileSync(
      path.join(destination, "integration.json"),
      JSON.stringify({ branch, commit: head, originalCheckout: task, evidence: existing }, null, 2) + "\n",
    );
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  console.log("Preserved integration evidence: " + destination);
  return destination;
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
  if (git("-C", task, "branch", "--show-current") !== branch || git("-C", task, "rev-parse", "HEAD") !== head)
    throw new Error("Task changed after integration");
  git("merge-base", "--is-ancestor", head, "main");
  if (git("-C", task, "status", "--porcelain", "--untracked-files=all")) throw new Error("Unfinished work preserved");
  for (const state of UNFINISHED_GIT_STATES)
    if (fs.existsSync(git("-C", task, "rev-parse", "--path-format=absolute", "--git-path", state)))
      throw new Error("Unfinished Git operation preserved");
  if (/^160000 /m.test(git("-C", task, "ls-files", "--stage"))) throw new Error("Submodule worktree preserved");
  const evidence = preserveIntegrationEvidence(main, task, branch, head);
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
  console.log("Removed completed worktree " + task + ", after preserving task artifacts; retained branch " + branch);
  return evidence;
}

function usage() {
  console.log(`Usage:
  node scripts/agent-worktree.mjs create --task <slug> [--base <branch>] [--detached] [--full-assets]
  node scripts/agent-worktree.mjs status --task <slug>
  node scripts/agent-worktree.mjs integrate --task <slug> [--keep-worktree]
  node scripts/agent-worktree.mjs finish --task <slug>
  node scripts/agent-worktree.mjs setup-integration
  node scripts/agent-worktree.mjs remove --task <slug> [--force]
  node scripts/agent-worktree.mjs list
  node scripts/agent-worktree.mjs prune

Creates isolated worktrees under .worktrees/<slug> on branch agent/<slug>.
Use one worktree per implementation chat to avoid shared-checkout races.
Add --detached for verification-only detached HEAD.
Source masters are omitted automatically when this revision supports prepared-only builds.
Add --full-assets for asset authoring; --code-only remains an alias for the default.
Restore masters in that checkout with: git sparse-checkout disable
setup-integration moves main to .worktrees/integration; preserves the original
checkout's files/index on a workspace branch. Run once when adopting this layout.
integrate verifies and advances main; finish preserves evidence and removes the task.
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

async function showTaskStatus(task) {
  try {
    await main(["status", "--task", task]);
  } catch (error) {
    console.error(`Status unavailable: ${error.message}. Retry: node scripts/agent-worktree.mjs status --task ${task}`);
  }
}

function recordFailedIntegration(task, tracker, error) {
  try {
    let directory = root;
    for (const segment of ["reports", "integrations", "attempts"]) {
      directory = path.join(directory, segment);
      if (fs.lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink())
        throw new Error("Attempt report directory is a symlink");
      try {
        fs.mkdirSync(directory);
      } catch (error) {
        if (error.code !== "EEXIST" || fs.lstatSync(directory).isSymbolicLink()) throw error;
      }
    }
    const file = path.join(directory, `${task}-${randomUUID()}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          task,
          status: "failed",
          phase: tracker.phase,
          reason: String(error?.message ?? error).slice(0, 2000),
          startedAt: new Date(tracker.started).toISOString(),
          elapsedMs: Date.now() - tracker.started,
          attempts: tracker.attempts,
          verificationMs: tracker.verificationMs,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    console.error(`Failed integration attempt: ${file}`);
  } catch (reportError) {
    console.error(`Could not record failed integration attempt: ${reportError.message}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const taskIndex = argv.indexOf("--task");
  const task =
    argv[0] === "integrate"
      ? slugify(
          argv.find((arg) => arg.startsWith("--task="))?.slice(7) ?? (taskIndex >= 0 ? argv[taskIndex + 1] : "") ?? "",
        )
      : "";
  const tracker =
    task && task !== "integration" ? { started: Date.now(), phase: "setup", attempts: 0, verificationMs: 0 } : null;
  try {
    return await runMain(argv, tracker);
  } catch (error) {
    if (tracker) recordFailedIntegration(task, tracker, error);
    throw error;
  }
}

async function runMain(argv, tracker) {
  const [cmd, ...rest] = argv;

  if (["create", "status", "integrate", "finish", "setup-integration", "remove", "list", "prune"].includes(cmd)) {
    const valueOptions =
      cmd === "create"
        ? ["--task", "--base"]
        : ["remove", "status", "integrate", "finish"].includes(cmd)
          ? ["--task"]
          : [];
    const flagOptions =
      cmd === "create"
        ? ["--detached", "--code-only", "--full-assets"]
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

  // Commands work from any checkout, while task paths and evidence stay rooted
  // in the original workspace rather than the dedicated main checkout.
  const shared = runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (shared.status === 0 && path.basename(shared.stdout.trim()) === ".git") {
    root = path.resolve(path.dirname(shared.stdout.trim()));
    WORKTREE_ROOT = path.join(root, ".worktrees");
  }
  const canonicalScript = path.join(WORKTREE_ROOT, "integration", "scripts", "agent-worktree.mjs");
  if (currentFile === path.join(root, "scripts", "agent-worktree.mjs") && fs.existsSync(canonicalScript)) {
    const owner = runGit(["-C", path.dirname(path.dirname(canonicalScript)), "symbolic-ref", "--quiet", "HEAD"]);
    if (owner.status === 0 && owner.stdout.trim() === "refs/heads/main") {
      const delegated = spawnSync(process.execPath, [canonicalScript, ...argv], { cwd: root, stdio: "inherit" });
      if (delegated.status !== 0) process.exitCode = delegated.status ?? 1;
      return;
    }
  }

  if (cmd === "status") {
    const task = slugify(getArg("--task") ?? "");
    if (!task || task === "integration") throw new Error("missing, reserved or invalid --task slug");
    const taskPath = path.join(WORKTREE_ROOT, task);
    const stateFile = path.join(root, "reports", "integrations", `${task}.json`);
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
    const git = (...args) => {
      const result = runGit(args);
      if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args[0]} failed`);
      return result.stdout.trim();
    };
    console.log(`Task: ${task}\nWorkspace: ${root}\nCheckout: ${taskPath}\nMain: ${git("rev-parse", "main")}`);
    if (!fs.existsSync(taskPath)) {
      console.log(`Checkout absent. Recorded state: ${state ? `${state.integration}/${state.cleanup}` : "none"}.`);
      if (state?.integration === "passed" && state.cleanup === "passed")
        console.log("Task finished; the branch and recorded evidence are retained.");
      else console.log("Inspect the retained branch and recorded state before creating or recovering work.");
      return;
    }
    const branch = git("-C", taskPath, "branch", "--show-current");
    const head = git("-C", taskPath, "rev-parse", "HEAD");
    const baseResult = runGit(["config", "--get", `branch.agent/${task}.alchemyTaskBase`]);
    if (baseResult.status !== 0 && baseResult.status !== 1) throw new Error("Cannot read task base");
    const base = baseResult.stdout.trim() || "not recorded";
    const dirty = git("-C", taskPath, "status", "--short", "--untracked-files=all");
    const changes = git("-C", taskPath, "diff", "--name-only", "main...HEAD");
    const markers = UNFINISHED_GIT_STATES.filter((marker) => {
      const location = git("-C", taskPath, "rev-parse", "--path-format=absolute", "--git-path", marker);
      return fs.existsSync(location);
    });
    console.log(`Branch: ${branch || "detached"}\nHead: ${head}\nOriginal base: ${base}`);
    console.log(`Committed task paths since shared main ancestor:\n${changes || "  none"}`);
    const validRevision = (value) => typeof value === "string" && /^[a-f0-9]{40,64}$/u.test(value);
    if (state?.integration === "passed" && state.commit === head) {
      const exactBase = validRevision(state.reviewBase) ? state.reviewBase : null;
      const reviewBase = exactBase ?? (validRevision(base) ? base : null);
      if (reviewBase && validRevision(head)) {
        const reviewPaths = git("-C", taskPath, "diff", "--no-renames", "--name-only", reviewBase, head);
        console.log(
          exactBase
            ? `Integrated changes against verified main ${reviewBase}:\n${reviewPaths || "  none"}`
            : `Changes since original base ${reviewBase} (may include concurrent main changes):\n${reviewPaths || "  none"}`,
        );
        console.log(`Review from the task checkout: git diff ${reviewBase} ${head}`);
      } else console.log("Integration review base unavailable; inspect task history and integration evidence.");
    }
    console.log(`Working paths:\n${dirty || "  none"}`);
    console.log(`Recorded integration: ${state ? `${state.integration}/${state.cleanup} at ${state.commit}` : "none"}`);
    const evidenceModule = path.join(path.dirname(currentFile), "lib/agent/task-evidence.mjs");
    let currentPassingCheck = false;
    if (fs.existsSync(evidenceModule)) {
      const { latestTaskCheck } = await import(pathToFileURL(evidenceModule).href);
      const check = latestTaskCheck(taskPath);
      if (!check) console.log("Latest task check: no coverage receipt found.");
      else if (check.error) console.log(`Latest check: freshness unavailable (${check.error}); ${check.file}`);
      else {
        currentPassingCheck = check.current && check.receipt.status === "passed";
        console.log(
          `Latest check: ${check.receipt.status ?? "unknown"}; ${check.current ? "current task selection and source" : "historical or freshness unverified"}; ${check.file}`,
        );
        console.log(
          `Checked paths: ${check.receipt.selectedPaths?.length ?? "unknown"}; profile: ${check.receipt.profile ?? "unknown"}.`,
        );
        for (const step of check.receipt.steps ?? [])
          console.log(`  ${step.status}: ${step.label}${step.reason ? ` — ${step.reason}` : ""}`);
        for (const limitation of check.receipt.limitations ?? []) console.log(`  Deferred: ${limitation}`);
      }
    }
    console.log("Visual quality, interaction review and CI status are not established by task status.");
    if (markers.length)
      console.log(`Blocked by unfinished Git operation: ${markers.join(", ")}; resolve it before continuing.`);
    else if (branch !== `agent/${task}`)
      console.log("Blocked: checkout is not on the expected task branch; inspect it.");
    else if (dirty)
      console.log(
        `Next in ${taskPath}: review task-owned changes, ${currentPassingCheck ? "confirm the check scope" : "run npm run check"}, and commit them.`,
      );
    else if (state?.integration === "passed" && state.commit === head) {
      const contained = runGit(["merge-base", "--is-ancestor", head, "main"]);
      if (contained.status === 0 && state.cleanup === "blocked")
        console.log(
          `Cleanup blocked: ${state.error ?? "inspect recorded state"}. Resolve the reported condition, then retry node scripts/agent-worktree.mjs finish --task ${task}`,
        );
      else if (contained.status === 0)
        console.log(`Next: review integration, then node scripts/agent-worktree.mjs finish --task ${task}`);
      else if (contained.status === 1)
        console.log("Recorded commit is no longer contained in main; inspect before continuing.");
      else throw new Error("Cannot verify integration ancestry");
    } else if (!changes) console.log("Next: implement the task; no committed task changes are visible.");
    else
      console.log(
        `Next: review the task and its checks, then node scripts/agent-worktree.mjs integrate --task ${task}`,
      );
    console.log(
      `Review is not recorded by status; confirm it and the check scope before integration. State: ${stateFile}`,
    );
    return;
  }

  if (cmd === "list") {
    const r = runGit(["worktree", "list"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }

  if (cmd === "prune") {
    const r = runGit(["worktree", "prune", "-v"], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }

  if (["integrate", "finish", "setup-integration"].includes(cmd)) {
    const task = cmd === "setup-integration" ? "integration" : slugify(getArg("--task") ?? "");
    if (!task || (task === "integration" && cmd !== "setup-integration"))
      throw new Error("missing, reserved or invalid --task slug");
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
    let taskPort = 20000 + (createHash("sha256").update(`${common}:${task}`).digest().readUInt32BE(0) % 40000);
    if (taskPort === port) taskPort = 20000 + ((taskPort - 20000 + 1) % 40000);
    // Keep this task stable while peers verify independently. The shared lock
    // protects only main snapshots, merges and advancement, never test-lane waits.
    if (tracker) tracker.phase = "task lock";
    const taskLock = await acquireExclusivePort(taskPort, { label: "Task integration lock" });
    try {
      if (tracker) tracker.phase = "checkout validation";
      const records = git(root, ["worktree", "list", "--porcelain", "-z"], true).split("\0\0");
      const mainRecord = records.find((record) => record.split("\0").includes("branch refs/heads/main"));
      if (!mainRecord) throw new Error("main must have a registered checkout; nothing integrated.");
      const mainPath = path.resolve(mainRecord.split("\0")[0].slice("worktree ".length));
      if (cmd === "setup-integration") {
        const lock = await acquireExclusivePort(port, { label: "Integration lock" });
        try {
          const dedicated = path.join(WORKTREE_ROOT, "integration");
          if (mainPath === dedicated) {
            console.log(`Integration checkout ready: ${dedicated}`);
            return;
          }
          if (mainPath !== root) throw new Error("main already belongs to another checkout; no branches changed");
          if (fs.existsSync(dedicated)) throw new Error("Integration destination exists; inspect it before setup");
          for (const marker of UNFINISHED_GIT_STATES) {
            if (fs.existsSync(path.resolve(root, git(root, ["rev-parse", "--git-path", marker]))))
              throw new Error("Resolve the unfinished Git operation before integration setup");
          }
          let workspace = "workspace/main";
          let suffix = 1;
          while (spawnSync("git", ["show-ref", "--verify", `refs/heads/${workspace}`], { cwd: root }).status === 0)
            workspace = `workspace/main-${suffix++}`;
          const head = git(root, ["rev-parse", "main"]);
          git(root, ["branch", workspace, head]);
          // Repoint HEAD only: checkout would risk changing staged/unstaged files.
          git(root, ["symbolic-ref", "HEAD", `refs/heads/${workspace}`]);
          try {
            git(root, ["worktree", "add", dedicated, "main"]);
          } catch (error) {
            git(root, ["symbolic-ref", "HEAD", "refs/heads/main"]);
            throw error;
          }
          linkDependencies(root, dedicated);
          console.log(`Integration checkout ready: ${dedicated}`);
          console.log(`Original workspace preserved on ${workspace}; files and index unchanged.`);
          return;
        } finally {
          await lock.release();
        }
      }
      const taskPath = path.join(WORKTREE_ROOT, task);
      const taskRecord = records.find(
        (record) => path.resolve(record.split("\0")[0].slice("worktree ".length)) === taskPath,
      );
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
      const stateDirectory = path.join(root, "reports", "integrations");
      for (const directory of [path.join(root, "reports"), stateDirectory]) {
        if (fs.lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink())
          throw new Error("Integration state directory is a symlink; checkout preserved");
        fs.mkdirSync(directory, { recursive: true });
      }
      const stateFile = path.join(stateDirectory, `${task}.json`);
      const saveState = (state) => {
        const temporary = `${stateFile}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n");
        fs.renameSync(temporary, stateFile);
      };
      if (cmd === "finish") {
        clean(taskPath, `agent/${task}`);
        const head = git(taskPath, ["rev-parse", "HEAD"]);
        git(root, ["merge-base", "--is-ancestor", head, "main"]);
        let previous = null;
        try {
          if (fs.existsSync(stateFile)) previous = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        } catch {
          // A malformed old report must not prevent safe cleanup of an integrated checkout.
        }
        try {
          const helper = path.join(path.dirname(currentFile), "lyrics-trial/managed-env.py");
          const managed = path.join(taskPath, ".cache/alchemy-lyrics-venv");
          if (!fs.existsSync(helper) && fs.existsSync(managed))
            throw new Error("Managed environment ownership cannot be checked; checkout preserved");
          let releaseManaged = async () => {};
          if (fs.existsSync(helper) && process.platform !== "win32") {
            try {
              releaseManaged = await (
                await import("./lib/managed-tool-lock.mjs")
              ).holdManagedToolLock(helper, taskPath);
            } catch (error) {
              if (error.code !== "ENOENT" || fs.existsSync(managed)) throw error;
            }
          } else if (fs.existsSync(managed)) {
            throw new Error("Managed environment ownership cannot be checked; checkout preserved");
          }
          try {
            const browsers = path.join(taskPath, "scripts/lib/agent-browser-session.mjs");
            if (fs.existsSync(browsers)) {
              const { closeTaskBrowsers } = await import(pathToFileURL(browsers).href);
              await closeTaskBrowsers(taskPath);
            }
            const evidence = removeIntegratedWorktree(root, taskPath, `agent/${task}`, head);
            saveState({
              task,
              commit: head,
              integration: "passed",
              cleanup: "passed",
              evidence,
              ...(previous?.commit === head && previous.metrics ? { metrics: previous.metrics } : {}),
              ...(previous?.commit === head && previous.reviewBase ? { reviewBase: previous.reviewBase } : {}),
            });
            console.log(`Task finished. State: ${stateFile}`);
            await showTaskStatus(task);
          } finally {
            await releaseManaged();
          }
        } catch (error) {
          saveState({
            task,
            commit: head,
            integration: "passed",
            cleanup: "blocked",
            error: error.message,
            ...(previous?.commit === head && previous.metrics ? { metrics: previous.metrics } : {}),
            ...(previous?.commit === head && previous.reviewBase ? { reviewBase: previous.reviewBase } : {}),
          });
          throw new Error(
            `Integration remains complete; cleanup blocked: ${error.message}. Retry: node scripts/agent-worktree.mjs finish --task ${task}`,
            { cause: error },
          );
        }
        return;
      }
      console.log(`Integration phase: verify and advance main; retain task checkout and browsers.`);
      let taskHead;
      let reviewBase;
      const integrationStarted = Date.now();
      let attempts = 0;
      let verificationMs = 0;
      for (;;) {
        attempts++;
        if (tracker) {
          tracker.attempts = attempts;
          tracker.phase = "snapshot lock";
        }
        const snapshotLock = await acquireExclusivePort(port, { label: "Integration lock" });
        let mainHead;
        try {
          if (tracker) tracker.phase = "snapshot and merge";
          clean(mainPath, "main");
          clean(taskPath, `agent/${task}`);
          mainHead = git(mainPath, ["rev-parse", "HEAD"]);
          git(taskPath, [
            "merge",
            "--no-edit",
            "-m",
            "chore: incorporate main before integration\n\nUser-Facing: no",
            mainHead,
          ]);
          taskHead = git(taskPath, ["rev-parse", "HEAD"]);
        } finally {
          await snapshotLock.release();
        }
        const paths = git(taskPath, ["diff", "--no-renames", "--name-only", "-z", mainHead, taskHead], true)
          .split("\0")
          .filter(Boolean);
        if (paths.length) {
          if (tracker) tracker.phase = "verification";
          const { commandInvocation } = await import(
            pathToFileURL(path.join(taskPath, "scripts/lib/command-invocation.mjs")).href + `?commit=${taskHead}`
          );
          const verificationStarted = Date.now();
          const result = spawnSync(...commandInvocation("npm", ["run", "check", "--", ...paths]), {
            cwd: taskPath,
            stdio: "inherit",
          });
          verificationMs += Date.now() - verificationStarted;
          if (tracker) tracker.verificationMs = verificationMs;
          if (result.status !== 0)
            throw new Error(
              `Integration verification failed (exit ${result.status ?? "unavailable"}); task was not advanced into main.`,
            );
        }
        if (tracker) tracker.phase = "advance lock";
        const advanceLock = await acquireExclusivePort(port, { label: "Integration lock" });
        try {
          if (tracker) tracker.phase = "revalidate and advance";
          clean(taskPath, `agent/${task}`);
          clean(mainPath, "main");
          if (git(taskPath, ["rev-parse", "HEAD"]) !== taskHead)
            throw new Error("Task changed during verification; retry integration.");
          if (git(mainPath, ["rev-parse", "HEAD"]) !== mainHead) {
            console.log("Main advanced during verification; incorporating it and checking the combined result again.");
            continue;
          }
          git(mainPath, ["merge", "--ff-only", taskHead]);
          reviewBase = mainHead;
          break;
        } finally {
          await advanceLock.release();
        }
      }
      console.log(`Integrated ${task} into local main at ${taskHead}; no push performed.`);
      if (tracker) tracker.phase = "record integration";
      saveState({
        task,
        commit: taskHead,
        reviewBase,
        integration: "passed",
        cleanup: "pending",
        checkout: taskPath,
        metrics: { attempts, verificationMs, elapsedMs: Date.now() - integrationStarted },
      });
      console.log(
        `State: ${stateFile}. Review integration, then finish: node scripts/agent-worktree.mjs finish --task ${task}`,
      );
      await showTaskStatus(task);
    } finally {
      await taskLock.release();
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
    if (!task || task === "integration") {
      console.error("invalid --task slug");
      process.exit(1);
    }
    const detached = hasFlag("--detached");
    if (hasFlag("--code-only") && hasFlag("--full-assets"))
      throw new Error("Choose --full-assets or --code-only, not both");
    const { storageProfile, populateWorktree } = await import("./lib/worktree-storage.mjs");
    // Only the primary and dedicated main checkout are sources; never borrow a peer task.
    const mainSource = path.join(WORKTREE_ROOT, "integration");
    const source = fs.existsSync(mainSource) ? mainSource : root;
    const populate = () => {
      const commit = runGit(["-C", worktreePath, "rev-parse", "HEAD"]);
      if (commit.status !== 0) throw new Error("Could not resolve new checkout commit");
      populateWorktree(
        source,
        worktreePath,
        storageProfile(source, commit.stdout.trim(), { fullAssets: hasFlag("--full-assets") }),
      );
    };
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
      console.error("Reuse this checkout for the same task, or choose a new --task slug.");
      process.exit(1);
    }

    fs.mkdirSync(WORKTREE_ROOT, { recursive: true });

    if (detached) {
      const args = ["worktree", "add", "--no-checkout", "--detach", worktreePath, base];
      console.log(`▸ git ${args.join(" ")}`);
      const r = runGit(args, { stdio: "inherit" });
      if (r.status !== 0) process.exit(r.status ?? 1);
      populate();
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
        ? ["worktree", "add", "--no-checkout", worktreePath, branch]
        : ["worktree", "add", "--no-checkout", "-b", branch, worktreePath, base];

    console.log(`▸ git ${args.join(" ")}`);
    const r = runGit(args, { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
    populate();
    const linked = linkDependencies(root, worktreePath);
    // Keep the original base across commits, main merges and checkout recreation.
    // Older retained branches use their common ancestor so existing task work is included.
    const baseKey = `branch.${branch}.alchemyTaskBase`;
    const recordedBase = runGit(["config", "--local", "--get", baseKey]);
    if (recordedBase.status !== 0 && recordedBase.status !== 1)
      throw new Error("Could not read task base; worktree preserved");
    if (recordedBase.status === 1) {
      const initial = runGit(["merge-base", base, branch]);
      if (initial.status !== 0 || !initial.stdout.trim())
        throw new Error("Could not record task base; worktree preserved");
      const saved = runGit(["config", "--local", baseKey, initial.stdout.trim()]);
      if (saved.status !== 0) throw new Error("Could not record task base; worktree preserved");
    }
    console.log(`worktree ready: ${worktreePath} on ${branch} (base ${base})`);
    console.log(`  cd "${worktreePath}"  # work in isolation`);
    if (linked) {
      console.log("  node_modules linked from root checkout");
    } else {
      console.log("  npm ci  # install dependencies before verification");
    }
    console.log(`  cd "${root}"  # return before cleanup`);
    console.log(`  node scripts/agent-worktree.mjs status --task ${task}  # resume task workflow`);
    console.log(`  node scripts/agent-worktree.mjs finish --task ${task}  # after reviewing integration`);
    await showTaskStatus(task);
    return;
  }

  if (cmd === "remove") {
    const taskRaw = getArg("--task");
    if (!taskRaw) {
      console.error("missing --task <slug>");
      usage();
      process.exit(1);
    }
    const task = slugify(taskRaw);
    if (!task || task === "integration") {
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
  main().catch(async (error) => {
    console.error(error.message);
    const args = process.argv.slice(2);
    const index = args.indexOf("--task");
    const rawTask = index >= 0 ? args[index + 1] : args.find((arg) => arg.startsWith("--task="))?.slice(7);
    const task = slugify(rawTask ?? "");
    if (["create", "integrate", "finish"].includes(args[0]) && task && task !== "integration")
      await showTaskStatus(task);
    process.exitCode = 1;
  });
}
