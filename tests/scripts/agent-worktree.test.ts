import { createCleanup } from "@/lib/cleanup";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("worktree removal", () => {
  it.each([
    ["remove", "--task", "--force"],
    ["remove", "--task=--force", "--force"],
    ["remove", "--task=force", "--force", "--typo"],
    ["remove", "--task=force", "--force", "--task=other"],
    ["create", "--task=force", "--base", "--detached"],
  ])("preserves a worktree named force after malformed options: %j", (...args) => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const script = join(root, "scripts", "agent-worktree.mjs");
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
    const saved = join(root, ".worktrees", "force", "work.txt");
    mkdirSync(join(root, ".worktrees", "force"), { recursive: true });
    writeFileSync(saved, "uncommitted work");
    const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(2);
    expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
  });

  it("reports failure when Git cannot start for list or prune", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const script = join(root, "scripts", "agent-worktree.mjs");
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
    for (const command of ["list", "prune"]) {
      const result = spawnSync(process.execPath, [script, command], {
        cwd: root,
        env: { ...process.env, PATH: root },
        encoding: "utf8",
      });
      expect(result.status, command).toBe(1);
    }
  });

  it("preserves directories for empty task slugs and unregistered worktrees", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const script = join(root, "scripts", "agent-worktree.mjs");
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
    const saved = join(root, ".worktrees", "kept", "work.txt");
    mkdirSync(join(root, ".worktrees", "kept"), { recursive: true });
    writeFileSync(saved, "uncommitted work");
    expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);

    const invalid = spawnSync(process.execPath, [script, "remove", "--task", "!!!"], { encoding: "utf8" });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("invalid --task slug");
    const unregistered = spawnSync(process.execPath, [script, "remove", "--task", "kept"], { encoding: "utf8" });
    expect(unregistered.status).toBe(1);
    expect(unregistered.stderr).toContain("Unregistered directory");
    expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
  });

  it("accepts --task=value and rejects case-variant collisions on create", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const script = join(root, "scripts", "agent-worktree.mjs");
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
    expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);

    const equalsForm = spawnSync(process.execPath, [script, "remove", "--task=missing"], { encoding: "utf8" });
    expect(equalsForm.status).toBe(0);
    expect(equalsForm.stdout).toContain("no worktree at");

    mkdirSync(join(root, ".worktrees", "Kept"), { recursive: true });
    const clash = spawnSync(process.execPath, [script, "create", "--task", "kept"], { encoding: "utf8" });
    expect(clash.status).toBe(1);
    expect(clash.stderr).toContain("collides with existing Kept");
  });

  it("symlinks root node_modules into the created worktree when present", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-nm-"));
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const script = join(root, "scripts", "agent-worktree.mjs");
    mkdirSync(join(root, "scripts"));
    copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "marker.txt"), "installed");
    expect(spawnSync("git", ["init", "-q", "-b", "main"], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["config", "user.name", "Test"], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["config", "user.email", "test@test.test"], { cwd: root }).status).toBe(0);
    writeFileSync(join(root, "file.txt"), "hello");
    expect(spawnSync("git", ["add", "."], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["commit", "-qm", "initial"], { cwd: root }).status).toBe(0);

    const result = spawnSync(process.execPath, [script, "create", "--task", "symlink-test"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const targetNm = join(root, ".worktrees", "symlink-test", "node_modules");
    expect(existsSync(targetNm)).toBe(true);
    expect(readFileSync(join(targetNm, "marker.txt"), "utf8")).toBe("installed");
  });
});

const recoveryRoots: string[] = [];
afterEach(() => {
  for (const root of recoveryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function integrationFixture(suffix = "") {
  const root = mkdtempSync(join(tmpdir(), `alchemy-integration-${suffix}`));
  const archive = root + "-archives";
  recoveryRoots.push(archive);
  const git = (args: string[], cwd = root) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  mkdirSync(join(root, "scripts"));
  const script = join(root, "scripts", "agent-worktree.mjs");
  copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
  mkdirSync(join(root, "scripts", "lib"));
  copyFileSync(
    join(process.cwd(), "scripts", "lib", "command-invocation.mjs"),
    join(root, "scripts", "lib", "command-invocation.mjs"),
  );
  copyFileSync(join(process.cwd(), "scripts/lib/exclusive-port.mjs"), join(root, "scripts/lib/exclusive-port.mjs"));
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Integration Test"]);
  git(["config", "user.email", "integration@example.test"]);
  git(["config", "commit.gpgsign", "false"]);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\nreports/\n");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { check: "node check.cjs", "docs:check": "node check.cjs" } }),
  );
  writeFileSync(
    join(root, "check.cjs"),
    `
const fs = require('node:fs');
if (process.env.INTEGRATION_DETACH) require('node:child_process').execFileSync('git', ['checkout', '--detach'], { cwd: process.env.INTEGRATION_DETACH, stdio: 'ignore' });
if (process.env.INTEGRATION_READY) {
  fs.writeFileSync(process.env.INTEGRATION_READY, 'ready');
  while (!fs.existsSync(process.env.INTEGRATION_RELEASE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
}
if (process.env.INTEGRATION_PROOF) fs.writeFileSync(process.env.INTEGRATION_PROOF, fs.readFileSync('main.txt', 'utf8') + fs.readFileSync('task.txt', 'utf8'));
if (process.env.INTEGRATION_PATHS) fs.writeFileSync(process.env.INTEGRATION_PATHS, JSON.stringify(process.argv.slice(2)));
process.exit(process.env.INTEGRATION_FAIL ? 1 : 0);
`,
  );
  writeFileSync(join(root, "shared.txt"), "base\n");
  git(["add", "."]);
  git(["commit", "-qm", "test: initialize fixture"]);
  const taskPath = join(root, ".worktrees", "task");
  expect(spawnSync(process.execPath, [script, "create", "--task", "task"]).status).toBe(0);
  writeFileSync(join(taskPath, "task.txt"), "task\n");
  git(["add", "task.txt"], taskPath);
  git(["commit", "-qm", "test: task change"], taskPath);
  const integrate = (env = {}) =>
    spawnSync(process.execPath, [script, "integrate", "--task", "task"], {
      env: { ...process.env, CODEX_WORKTREE_ARCHIVE_ROOT: archive, ...env },
      encoding: "utf8",
    });
  return { root, script, taskPath, git, integrate, archive };
}

describe("serialized local integration", () => {
  it.skipIf(process.platform === "win32")(
    "integrates and removes a checkout whose path Git would quote",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture("é space-\n");
      using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

      const result = integrate();
      expect(result.status, result.stderr).toBe(0);
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
      expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
      expect(existsSync(taskPath)).toBe(false);
    },
    20000,
  );

  it.each(["main", "task"])(
    "preserves an unfinished bisect in the %s checkout",
    (checkout) => {
      const { root, taskPath, git, integrate } = integrationFixture();
      using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));
      const selected = checkout === "main" ? root : taskPath;
      git(["bisect", "start"], selected);
      const before = git(["rev-parse", "main"]);

      const result = integrate();
      expect(result.status, result.stdout).toBe(1);
      expect(result.stderr).toContain("Unfinished Git operation");
      expect(git(["rev-parse", "main"])).toBe(before);
      expect(existsSync(taskPath)).toBe(true);
      expect(existsSync(git(["rev-parse", "--path-format=absolute", "--git-path", "BISECT_START"], selected))).toBe(
        true,
      );
    },
    20000,
  );

  it.skipIf(process.platform === "win32")(
    "preserves work hidden by a stale Git filesystem monitor",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();
      using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

      const monitor = join(root, ".git", "silent-fsmonitor");
      writeFileSync(monitor, "#!/bin/sh\nprintf 'stale-token\\0'\n", { mode: 0o755 });
      git(["config", "core.fsmonitor", monitor]);
      git(["config", "core.untrackedCache", "true"]);
      const before = git(["rev-parse", "main"]);
      for (const checkout of [root, taskPath]) {
        git(["status", "--porcelain"], checkout);
        writeFileSync(join(checkout, "shared.txt"), "unsaved work\n");
        expect(git(["status", "--porcelain"], checkout)).toBe("");
        const result = integrate();
        expect(result.status, result.stdout).toBe(1);
        expect(result.stderr).toContain("uncommitted work");
        expect(git(["rev-parse", "main"])).toBe(before);
        expect(readFileSync(join(checkout, "shared.txt"), "utf8")).toBe("unsaved work\n");
        writeFileSync(join(checkout, "shared.txt"), "base\n");
      }
      expect(git(["config", "core.fsmonitor"])).toBe(monitor);
      expect(git(["config", "core.untrackedCache"])).toBe("true");
    },
    20000,
  );

  it("checks both sides of a committed rename before integration", () => {
    const { root, taskPath, git, integrate } = integrationFixture();
    const paths = join(root, ".git", "checked-paths.json");
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    git(["mv", "shared.txt", "renamed.txt"], taskPath);
    git(["commit", "-qm", "test: move source"], taskPath);
    const result = integrate({ INTEGRATION_PATHS: paths });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(paths, "utf8"))).toEqual(["renamed.txt", "shared.txt", "task.txt"]);
  }, 20000);

  it("checks the combined result before advancing main and preserves main on a failed check", () => {
    const { root, taskPath, git, integrate } = integrationFixture();
    const proof = join(tmpdir(), `alchemy-proof-${process.pid}-${Date.now()}`);
    using _scopeCleanup = createCleanup(() => {
      rmSync(root, { recursive: true, force: true });
      rmSync(proof, { force: true });
    });

    writeFileSync(join(root, "main.txt"), "main\n");
    git(["add", "main.txt"]);
    git(["commit", "-qm", "test: concurrent main change"]);
    const before = git(["rev-parse", "main"]);
    const failed = integrate({ INTEGRATION_FAIL: "1" });
    expect(failed.status, failed.stderr).toBe(1);
    expect(git(["rev-parse", "main"])).toBe(before);
    const passed = integrate({ INTEGRATION_PROOF: proof });
    expect(passed.status, passed.stderr).toBe(0);
    expect(readFileSync(proof, "utf8")).toBe("main\ntask\n");
    expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
    expect(existsSync(taskPath)).toBe(false);
    expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
  }, 20000);

  it("refuses a main checkout detached at the same commit during verification", () => {
    const { root, git, integrate } = integrationFixture();
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    const before = git(["rev-parse", "main"]);
    const result = integrate({ INTEGRATION_DETACH: root });
    expect(result.status, result.stdout).toBe(1);
    expect(result.stderr).toContain("expected branch");
    expect(git(["rev-parse", "main"])).toBe(before);
    expect(git(["rev-parse", "HEAD"])).toBe(before);
    expect(existsSync(join(root, "task.txt"))).toBe(false);
  }, 20000);

  it("refuses dirty main and preserves a conflicting merge in the task worktree", () => {
    const { root, taskPath, git, integrate } = integrationFixture();
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

    writeFileSync(join(taskPath, "task.txt"), "unfinished task\n");
    const dirtyTask = integrate();
    expect(dirtyTask.status).toBe(1);
    expect(dirtyTask.stderr).toContain("uncommitted work");
    expect(readFileSync(join(taskPath, "task.txt"), "utf8")).toBe("unfinished task\n");
    writeFileSync(join(taskPath, "task.txt"), "task\n");
    writeFileSync(join(root, "shared.txt"), "main\n");
    const dirty = integrate();
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain("uncommitted work");
    expect(readFileSync(join(root, "shared.txt"), "utf8")).toBe("main\n");
    git(["add", "shared.txt"]);
    git(["commit", "-qm", "test: main conflict"]);
    writeFileSync(join(taskPath, "shared.txt"), "task\n");
    git(["add", "shared.txt"], taskPath);
    git(["commit", "-qm", "test: task conflict"], taskPath);
    const before = git(["rev-parse", "main"]);
    expect(integrate().status).toBe(1);
    expect(git(["rev-parse", "main"])).toBe(before);
    expect(git(["status", "--porcelain"], taskPath)).toContain("UU shared.txt");
    expect(readFileSync(join(taskPath, "shared.txt"), "utf8")).toContain("<<<<<<<");
    writeFileSync(join(taskPath, "shared.txt"), "task\n");
    git(["add", "shared.txt"], taskPath);
    // A resolved, staged merge can have no status entries yet still be unfinished.
    expect(git(["status", "--porcelain"], taskPath)).toBe("");
    const unfinished = integrate();
    expect(unfinished.status).toBe(1);
    expect(unfinished.stderr).toContain("Unfinished Git operation");
    expect(git(["rev-parse", "main"])).toBe(before);
  }, 20000);

  it("excludes a second integrator and releases the lock after an interrupted owner", async () => {
    const { root, script, taskPath, git, integrate } = integrationFixture();
    const signals = mkdtempSync(join(tmpdir(), "alchemy-lock-"));
    const ready = join(signals, "ready");
    const release = join(signals, "release");
    const before = git(["rev-parse", "main"]);
    const child = spawn(process.execPath, [script, "integrate", "--task", "task"], {
      env: { ...process.env, INTEGRATION_READY: ready, INTEGRATION_RELEASE: release },
      stdio: "ignore",
    });
    const closed = new Promise((resolve) => {
      child.once("close", resolve);
    });
    try {
      const deadline = Date.now() + 10000;
      while (!existsSync(ready) && Date.now() < deadline && child.exitCode === null) {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      }
      expect(existsSync(ready)).toBe(true);
      // Invoke from the task's script to exercise the shared Git-directory lock.
      const busy = spawnSync(
        process.execPath,
        [join(taskPath, "scripts", "agent-worktree.mjs"), "integrate", "--task", "task"],
        { encoding: "utf8", env: { ...process.env, ALCHEMY_LOCK_WAIT_MS: "0" } },
      );
      expect(busy.status).toBe(1);
      expect(busy.stderr).toContain("Integration lock busy");
      expect(git(["rev-parse", "main"])).toBe(before);
      child.kill("SIGKILL");
      writeFileSync(release, "release");
      await closed;
      const retry = integrate();
      expect(retry.status, retry.stderr).toBe(0);
    } finally {
      child.kill("SIGKILL");
      writeFileSync(release, "release");
      await closed;
      rmSync(root, { recursive: true, force: true });
      rmSync(signals, { recursive: true, force: true });
    }
  }, 20000);
});

it("preserves check evidence and captures before deleting outputs, retaining the branch and leaving peers untouched", () => {
  const { root, taskPath, git, integrate, archive } = integrationFixture();
  using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

  writeFileSync(join(root, "main.txt"), "main\n");
  git(["add", "main.txt"]);
  git(["commit", "-qm", "test: main"]);
  writeFileSync(join(taskPath, ".gitignore"), ".worktrees/\nreports/\nignored\nnode_modules/\n");
  git(["add", ".gitignore"], taskPath);
  git(["commit", "-qm", "test: ignore outputs"], taskPath);
  writeFileSync(join(taskPath, "ignored"), "local evidence");
  mkdirSync(join(taskPath, "node_modules"));
  writeFileSync(join(taskPath, "node_modules", "cached"), "rebuildable");
  mkdirSync(join(taskPath, "reports/runs/check-test"), { recursive: true });
  mkdirSync(join(taskPath, "reports/runs/reused-test"), { recursive: true });
  mkdirSync(join(taskPath, "reports/visual-review"));
  writeFileSync(join(taskPath, "reports/runs/check-test/run.md"), "passing integration check");
  writeFileSync(join(taskPath, "reports/runs/reused-test/output.log"), "original verification evidence");
  writeFileSync(join(taskPath, "reports/visual-review/screen.png"), "selected capture");
  writeFileSync(
    join(taskPath, "reports/current-run.json"),
    JSON.stringify({ runId: "check-test", artifacts: [{ path: "reports/runs/reused-test/output.log" }] }),
  );
  writeFileSync(join(taskPath, "reports/current-run.md"), "latest summary");
  // Completion closes the task's browsers before removing their launcher.
  writeFileSync(
    join(taskPath, "scripts/lib/agent-browser-session.mjs"),
    `import fs from 'node:fs'; export async function closeTaskBrowsers() { fs.mkdirSync(${JSON.stringify(join(root, "reports"))}, { recursive: true }); fs.writeFileSync(${JSON.stringify(join(root, "reports/browser-closed"))}, 'closed'); }`,
  );
  git(["add", "scripts/lib/agent-browser-session.mjs"], taskPath);
  git(["commit", "-qm", "test: browser lifecycle"], taskPath);
  const peer = join(root, ".worktrees", "peer");
  git(["worktree", "add", "-b", "agent/peer", peer]);
  writeFileSync(join(peer, "unfinished"), "peer work");
  const result = integrate();
  expect(result.status, result.stderr).toBe(0);
  expect(readdirSync(archive)).toEqual([]);
  expect(git(["worktree", "list", "--porcelain"])).not.toContain(taskPath);
  expect(readFileSync(join(peer, "unfinished"), "utf8")).toBe("peer work");
  expect(git(["rev-parse", "agent/task"])).toBe(git(["rev-parse", "main"]));
  const bundles = readdirSync(join(root, "reports/integrations"));
  expect(bundles).toHaveLength(1);
  const evidence = join(root, "reports/integrations", bundles[0]);
  expect(readFileSync(join(evidence, "reports/runs/check-test/run.md"), "utf8")).toBe("passing integration check");
  expect(readFileSync(join(evidence, "reports/runs/reused-test/output.log"), "utf8")).toBe(
    "original verification evidence",
  );
  expect(readFileSync(join(evidence, "reports/visual-review/screen.png"), "utf8")).toBe("selected capture");
  expect(JSON.parse(readFileSync(join(evidence, "integration.json"), "utf8")).commit).toBe(git(["rev-parse", "main"]));
  expect(readFileSync(join(root, "reports/browser-closed"), "utf8")).toBe("closed");
  expect(result.stdout).toContain("Preserved integration evidence:");
}, 20000);

it.skipIf(process.platform === "win32").each(["escaping artifact", "symlink"])(
  "preserves the integrated checkout when evidence contains an %s",
  (entry) => {
    const { root, taskPath, git, integrate } = integrationFixture();
    using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(taskPath, "reports/visual-review"), { recursive: true });
    if (entry === "symlink") symlinkSync(join(root, "shared.txt"), join(taskPath, "reports/visual-review/linked.txt"));
    else
      writeFileSync(
        join(taskPath, "reports/current-run.json"),
        JSON.stringify({ runId: "check-test", artifacts: [{ path: "../shared.txt" }] }),
      );
    const result = integrate();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("preserved");
    expect(existsSync(taskPath)).toBe(true);
    expect(readFileSync(join(root, "shared.txt"), "utf8")).toBe("base\n");
    expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
  },
  20000,
);

it("keeps an intermediate integration when requested", () => {
  const { root, taskPath, script, git, archive } = integrationFixture();
  using _scopeCleanup = createCleanup(() => rmSync(root, { recursive: true, force: true }));

  writeFileSync(join(root, "main.txt"), "main\n");
  git(["add", "main.txt"]);
  git(["commit", "-qm", "test: main"]);
  const result = spawnSync(process.execPath, [script, "integrate", "--task", "task", "--keep-worktree"], {
    encoding: "utf8",
    env: { ...process.env, CODEX_WORKTREE_ARCHIVE_ROOT: archive },
  });
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(taskPath)).toBe(true);
  expect(existsSync(archive)).toBe(false);
}, 20000);
