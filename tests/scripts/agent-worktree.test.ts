import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("worktree removal", () => {
  it("rejects malformed options before removing a worktree named force", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    try {
      const script = join(root, "scripts", "agent-worktree.mjs");
      mkdirSync(join(root, "scripts"));
      copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
      const saved = join(root, ".worktrees", "force", "work.txt");
      mkdirSync(join(root, ".worktrees", "force"), { recursive: true });
      writeFileSync(saved, "uncommitted work");
      expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);
      for (const args of [
        ["remove", "--task", "--force"],
        ["remove", "--task=--force", "--force"],
        ["remove", "--task=force", "--force", "--typo"],
        ["remove", "--task=force", "--force", "--task=other"],
        ["create", "--task=force", "--base", "--detached"],
      ]) {
        const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
        expect(result.status, result.stderr).toBe(2);
        expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports failure when Git cannot start for list or prune", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    try {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves directories for empty task slugs and unregistered worktrees", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    try {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts --task=value and rejects case-variant collisions on create", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    try {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function integrationFixture() {
  const root = mkdtempSync(join(tmpdir(), "alchemy-integration-"));
  const git = (args: string[], cwd = root) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  mkdirSync(join(root, "scripts"));
  const script = join(root, "scripts", "agent-worktree.mjs");
  copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Integration Test"]);
  git(["config", "user.email", "integration@example.test"]);
  git(["config", "commit.gpgsign", "false"]);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\n");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ scripts: { check: "node check.cjs", "docs:check": "node check.cjs" } }),
  );
  writeFileSync(
    join(root, "check.cjs"),
    `
const fs = require('node:fs');
if (process.env.INTEGRATION_READY) {
  fs.writeFileSync(process.env.INTEGRATION_READY, 'ready');
  while (!fs.existsSync(process.env.INTEGRATION_RELEASE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
}
if (process.env.INTEGRATION_PROOF) fs.writeFileSync(process.env.INTEGRATION_PROOF, fs.readFileSync('main.txt', 'utf8') + fs.readFileSync('task.txt', 'utf8'));
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
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
  return { root, script, taskPath, git, integrate };
}

describe("serialized local integration", () => {
  it("checks the combined result before advancing main and preserves main on a failed check", () => {
    const { root, taskPath, git, integrate } = integrationFixture();
    const proof = join(tmpdir(), `alchemy-proof-${process.pid}-${Date.now()}`);
    try {
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
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "HEAD"], taskPath));
      expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(proof, { force: true });
    }
  });

  it("refuses dirty main and preserves a conflicting merge in the task worktree", () => {
    const { root, taskPath, git, integrate } = integrationFixture();
    try {
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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
    const closed = new Promise((resolve) => child.once("close", resolve));
    try {
      const deadline = Date.now() + 10000;
      while (!existsSync(ready) && Date.now() < deadline && child.exitCode === null) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(existsSync(ready)).toBe(true);
      // Invoke from the task's script to exercise the shared Git-directory lock.
      const busy = spawnSync(
        process.execPath,
        [join(taskPath, "scripts", "agent-worktree.mjs"), "integrate", "--task", "task"],
        { encoding: "utf8" },
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
