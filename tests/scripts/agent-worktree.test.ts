import { runNode, copyFixtureFiles } from "../helpers/script-fixtures";
import { createCleanup } from "@/lib/cleanup";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

function worktreeFixture(prefix = "alchemy-worktree-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  recoveryRoots.push(root);
  copyFixtureFiles(root, ["scripts/agent-worktree.mjs", "scripts/lib/worktree-storage.mjs"]);
  const script = join(root, "scripts/agent-worktree.mjs");
  return { root, script };
}

describe("worktree removal", () => {
  it.each([
    ["remove", "--task", "--force"],
    ["remove", "--task=--force", "--force"],
    ["remove", "--task=force", "--force", "--typo"],
    ["remove", "--task=force", "--force", "--task=other"],
    ["create", "--task=force", "--base", "--detached"],
  ])("preserves a worktree named force after malformed options: %j", (...args) => {
    const { root, script } = worktreeFixture("alchemy-worktree-");
    const saved = join(root, ".worktrees", "force", "work.txt");
    mkdirSync(join(root, ".worktrees", "force"), { recursive: true });
    writeFileSync(saved, "uncommitted work");
    const result = runNode([script, ...args], { cwd: root });
    expect(result.status, result.stderr).toBe(2);
    expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
  });

  it("reports failure when Git cannot start for list or prune", () => {
    const { root, script } = worktreeFixture("alchemy-worktree-");
    for (const command of ["list", "prune"]) {
      const result = runNode([script, command], { cwd: root, env: { ...process.env, PATH: root } });
      expect(result.status, command).toBe(1);
    }
  });

  it("preserves directories for empty task slugs and unregistered worktrees", () => {
    const { root, script } = worktreeFixture("alchemy-worktree-");
    const saved = join(root, ".worktrees", "kept", "work.txt");
    mkdirSync(join(root, ".worktrees", "kept"), { recursive: true });
    writeFileSync(saved, "uncommitted work");
    expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);

    const invalid = runNode([script, "remove", "--task", "!!!"]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("invalid --task slug");
    const unregistered = runNode([script, "remove", "--task", "kept"]);
    expect(unregistered.status).toBe(1);
    expect(unregistered.stderr).toContain("Unregistered directory");
    expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
  });

  it("accepts --task=value and rejects case-variant collisions on create", () => {
    const { root, script } = worktreeFixture("alchemy-worktree-");
    expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);

    const equalsForm = runNode([script, "remove", "--task=missing"]);
    expect(equalsForm.status).toBe(0);
    expect(equalsForm.stdout).toContain("no worktree at");

    mkdirSync(join(root, ".worktrees", "Kept"), { recursive: true });
    const clash = runNode([script, "create", "--task", "kept"]);
    expect(clash.status).toBe(1);
    expect(clash.stderr).toContain("collides with existing Kept");
  });

  it("symlinks root node_modules into the created worktree when present", () => {
    const { root, script } = worktreeFixture("alchemy-worktree-nm-");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "marker.txt"), "installed");
    expect(spawnSync("git", ["init", "-q", "-b", "main"], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["config", "user.name", "Test"], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["config", "user.email", "test@test.test"], { cwd: root }).status).toBe(0);
    writeFileSync(join(root, "file.txt"), "hello");
    expect(spawnSync("git", ["add", "."], { cwd: root }).status).toBe(0);
    expect(spawnSync("git", ["commit", "-qm", "initial"], { cwd: root }).status).toBe(0);

    const result = runNode([script, "create", "--task", "symlink-test"], { cwd: root });
    expect(result.status, result.stderr).toBe(0);
    const targetNm = join(root, ".worktrees", "symlink-test", "node_modules");
    expect(existsSync(targetNm)).toBe(true);
    expect(readFileSync(join(targetNm, "marker.txt"), "utf8")).toBe("installed");
    const base = spawnSync("git", ["config", "--local", "--get", "branch.agent/symlink-test.alchemyTaskBase"], {
      cwd: root,
      encoding: "utf8",
    });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
    expect(base.status, base.stderr).toBe(0);
    expect(base.stdout.trim()).toBe(head.stdout.trim());
  });

  it("creates default code-only worktrees without removing masters from the original checkout", () => {
    const { root, script } = worktreeFixture("alchemy-code-only-");
    const git = (...args: string[]) => {
      const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout;
    };
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.test");
    mkdirSync(join(root, "assets/sources"), { recursive: true });
    mkdirSync(join(root, "src/assets/optimized"), { recursive: true });
    copyFixtureFiles(root, ["package.json"]);
    copyFixtureFiles(root, ["scripts/check-prepared-assets.mjs"]);
    for (const directory of ["public/Music", "public/sounds"]) {
      mkdirSync(join(root, directory), { recursive: true });
      writeFileSync(join(root, directory, "ready.bin"), "prepared");
    }
    writeFileSync(join(root, "assets/sources/master.png"), "master");
    writeFileSync(join(root, "assets/sources/README.md"), "# Source artwork\n");
    mkdirSync(join(root, "assets/sources/docs"));
    writeFileSync(join(root, "assets/sources/docs/policy.mdx"), "# Authoring policy\n");
    writeFileSync(join(root, "assets/sources/docs/master.psd"), "nested master");
    writeFileSync(join(root, "src/assets/optimized/ready.webp"), "prepared");
    git("add", ".");
    git("commit", "-qm", "initial");
    const result = runNode([script, "create", "--task", "small"], { cwd: root });
    expect(result.status, result.stderr).toBe(0);
    const small = join(root, ".worktrees/small");
    expect(existsSync(join(small, "assets/sources/master.png"))).toBe(false);
    expect(existsSync(join(small, "assets/sources/docs/master.psd"))).toBe(false);
    expect(readFileSync(join(small, "assets/sources/README.md"), "utf8")).toBe("# Source artwork\n");
    expect(readFileSync(join(small, "assets/sources/docs/policy.mdx"), "utf8")).toBe("# Authoring policy\n");
    expect(result.stdout).toContain("omitted 19 logical bytes");
    expect(readFileSync(join(small, "src/assets/optimized/ready.webp"), "utf8")).toBe("prepared");
    expect(readFileSync(join(root, "assets/sources/master.png"), "utf8")).toBe("master");
    expect(git("-C", small, "status", "--porcelain")).toBe("");
    git("-C", small, "sparse-checkout", "disable");
    expect(readFileSync(join(small, "assets/sources/master.png"), "utf8")).toBe("master");
  });
});

const recoveryRoots: string[] = [];
afterEach(() => {
  for (const root of recoveryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function integrationFixture(suffix = "", { codeOnlyDocumentation = false } = {}) {
  const { root, script } = worktreeFixture(`alchemy-integration-${suffix}`);
  const archive = root + "-archives";
  recoveryRoots.push(archive);
  const git = (args: string[], cwd = root) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  copyFixtureFiles(root, ["scripts/lib/command-invocation.mjs", "scripts/lib/exclusive-port.mjs"]);
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.name", "Integration Test"]);
  git(["config", "user.email", "integration@example.test"]);
  git(["config", "commit.gpgsign", "false"]);
  writeFileSync(join(root, ".gitignore"), ".worktrees/\nreports/\n");
  const scripts: Record<string, string> = { check: "node check.cjs", "docs:check": "node check.cjs" };
  if (codeOnlyDocumentation) {
    scripts["assets:check:outputs"] = "node scripts/check-prepared-assets.mjs --check --outputs-only";
    scripts["verify:assets"] = "npm run assets:check:outputs";
    copyFixtureFiles(root, ["scripts/check-prepared-assets.mjs"]);
    mkdirSync(join(root, "scripts/lib/agent"), { recursive: true });
    copyFixtureFiles(root, ["scripts/lib/agent/markdown-sections.mjs"]);
    for (const directory of ["assets/sources/docs", "src/assets/optimized", "public/Music", "public/sounds", "Docs"])
      mkdirSync(join(root, directory), { recursive: true });
    for (const directory of ["src/assets/optimized", "public/Music", "public/sounds"])
      writeFileSync(join(root, directory, "ready.bin"), "prepared");
    writeFileSync(join(root, "assets/sources/master.png"), "master");
    writeFileSync(join(root, "assets/sources/docs/master.psd"), "nested master");
    writeFileSync(join(root, "assets/sources/README.md"), "# Sources\n\n[Policy](docs/policy.mdx)\n");
    writeFileSync(join(root, "assets/sources/docs/policy.mdx"), "# Policy\n\n[Sources](../README.md)\n");
    writeFileSync(
      join(root, "Docs/WORKFLOWS-ASSETS.md"),
      "# Asset workflow\n\n[Sources](../assets/sources/README.md)\n",
    );
    writeFileSync(
      join(root, "scripts/check-documentation-links.mjs"),
      `
import fs from 'node:fs';
import path from 'node:path';
import { extractMarkdownLinkTargets } from './lib/agent/markdown-sections.mjs';
for (const file of ['Docs/WORKFLOWS-ASSETS.md', 'assets/sources/README.md', 'assets/sources/docs/policy.mdx']) {
  for (const { target } of extractMarkdownLinkTargets(fs.readFileSync(file, 'utf8'))) {
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) throw new Error('Broken documentation link: ' + target);
  }
}
if (['assets/sources/master.png', 'assets/sources/docs/master.psd'].some(file => fs.existsSync(file)))
  throw new Error('Source masters were unexpectedly materialized');
fs.writeFileSync(process.env.INTEGRATION_DOCUMENTATION_PROOF, JSON.stringify({ cwd: process.cwd(), documentationLinksPassed: true, mastersOmitted: true }));
`,
    );
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts }));
  writeFileSync(
    join(root, "check.cjs"),
    `
const fs = require('node:fs');
if (process.env.INTEGRATION_DOCUMENTATION_PROOF) require('node:child_process').execFileSync(process.execPath, ['scripts/check-documentation-links.mjs'], { stdio: 'inherit' });
if (process.env.INTEGRATION_DETACH) require('node:child_process').execFileSync('git', ['checkout', '--detach'], { cwd: process.env.INTEGRATION_DETACH, stdio: 'ignore' });
if (process.env.INTEGRATION_READY) {
  fs.writeFileSync(process.env.INTEGRATION_READY, 'ready');
  while (!fs.existsSync(process.env.INTEGRATION_RELEASE)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
}
if (process.env.INTEGRATION_PROOF) fs.writeFileSync(process.env.INTEGRATION_PROOF, fs.readFileSync('main.txt', 'utf8') + fs.readFileSync('task.txt', 'utf8'));
if (process.env.INTEGRATION_PATHS) fs.writeFileSync(process.env.INTEGRATION_PATHS, JSON.stringify(process.argv.slice(2)));
if (process.env.INTEGRATION_CHECKS) fs.appendFileSync(process.env.INTEGRATION_CHECKS, require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }));
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
  const run = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    runNode([script, ...args], { env: { ...process.env, CODEX_WORKTREE_ARCHIVE_ROOT: archive, ...env } });
  const integrate = (env = {}) => {
    const integrated = run(["integrate", "--task", "task", "--keep-worktree"], env);
    if (integrated.status !== 0) return integrated;
    const finished = run(["finish", "--task", "task"], env);
    return { ...finished, stdout: integrated.stdout + finished.stdout, stderr: integrated.stderr + finished.stderr };
  };
  return { root, script, taskPath, git, integrate, archive, run };
}

describe("serialized local integration", () => {
  it(
    "reports safe next steps for dirty, integrated and cleaned task states",
    () => {
      const { root, taskPath, run } = integrationFixture();

      writeFileSync(join(taskPath, "unfinished.txt"), "preserve");
      const dirty = run(["status", "--task", "task"]);
      expect(dirty.status, dirty.stderr).toBe(0);
      expect(dirty.stdout).toContain("unfinished.txt");
      expect(dirty.stdout).toContain("run npm run check");
      expect(dirty.stdout).toContain("Review is not recorded by status");
      expect(dirty.stdout).toMatch(/Next in .*\/\.worktrees\/task:/u);
      expect(readFileSync(join(taskPath, "unfinished.txt"), "utf8")).toBe("preserve");
      rmSync(join(taskPath, "unfinished.txt"));
      const integrated = run(["integrate", "--task", "task", "--keep-worktree"]);
      expect(integrated.status, integrated.stderr).toBe(0);
      expect(run(["status", "--task", "task"]).stdout).toContain("review integration");
      const finish = run(["finish", "--task", "task"]);
      expect(finish.status, finish.stderr).toBe(0);
      expect(run(["status", "--task", "task"]).stdout).toContain("Checkout absent");
      expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8")).metrics.attempts).toBe(1);
    },
    ciTimeout(20000),
  );

  it(
    "shows the verified integration delta without including concurrent main work",
    () => {
      const { root, taskPath, git, run } = integrationFixture();

      writeFileSync(join(root, "main.txt"), "concurrent work\n");
      git(["add", "main.txt"]);
      git(["commit", "-qm", "test: concurrent main"]);
      const verifiedMain = git(["rev-parse", "main"]);
      const integrated = run(["integrate", "--task", "task", "--keep-worktree"]);
      expect(integrated.status, integrated.stderr).toBe(0);
      const statePath = join(root, "reports/integrations/task.json");
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      expect(state.reviewBase).toBe(verifiedMain);
      const status = run(["status", "--task", "task"]);
      expect(status.status, status.stderr).toBe(0);
      expect(status.stdout).toContain(`Integrated changes against verified main ${verifiedMain}:\ntask.txt`);
      expect(status.stdout).not.toContain("main.txt");
      expect(status.stdout).toContain(`diff ${verifiedMain} ${git(["rev-parse", "HEAD"], taskPath)}`);
      delete state.reviewBase;
      writeFileSync(statePath, JSON.stringify(state));
      const legacy = run(["status", "--task", "task"]);
      expect(legacy.stdout).toContain("may include concurrent main changes");
      expect(legacy.stdout).toContain("main.txt");
      writeFileSync(statePath, JSON.stringify({ ...state, reviewBase: verifiedMain }));
      const finished = run(["finish", "--task", "task"]);
      expect(finished.status, finished.stderr).toBe(0);
      expect(JSON.parse(readFileSync(statePath, "utf8")).reviewBase).toBe(verifiedMain);
    },
    ciTimeout(20000),
  );

  it(
    "moves main to a dedicated checkout without changing dirty workspace files or index",
    () => {
      const { root, script, taskPath, git, integrate } = integrationFixture();

      writeFileSync(join(root, "shared.txt"), "staged work\n");
      git(["add", "shared.txt"]);
      writeFileSync(join(root, "shared.txt"), "unstaged work\n");
      writeFileSync(join(root, "untracked.txt"), "untracked work\n");
      const index = readFileSync(join(root, ".git/index"));
      const before = git(["rev-parse", "main"]);
      const setup = runNode([script, "setup-integration"]);
      expect(setup.status, setup.stderr).toBe(0);
      const main = join(root, ".worktrees/integration");
      expect(git(["branch", "--show-current"])).toBe("workspace/main");
      expect(git(["branch", "--show-current"], main)).toBe("main");
      expect(git(["rev-parse", "main"])).toBe(before);
      expect(readFileSync(join(root, ".git/index"))).toEqual(index);
      expect(readFileSync(join(root, "shared.txt"), "utf8")).toBe("unstaged work\n");
      expect(git(["show", ":shared.txt"])).toBe("staged work");
      expect(readFileSync(join(root, "untracked.txt"), "utf8")).toBe("untracked work\n");
      const repeated = runNode([script, "setup-integration"]);
      expect(repeated.status, repeated.stderr).toBe(0);
      const result = integrate();
      expect(result.status, result.stderr).toBe(0);
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
      expect(git(["rev-parse", "HEAD"])).toBe(before);
      expect(readFileSync(join(root, "shared.txt"), "utf8")).toBe("unstaged work\n");
      expect(git(["show", ":shared.txt"])).toBe("staged work");
      expect(readFileSync(join(main, "task.txt"), "utf8")).toBe("task\n");
      expect(existsSync(taskPath)).toBe(false);
      expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8"))).toMatchObject({
        integration: "passed",
        cleanup: "passed",
      });
    },
    ciTimeout(20000),
  );

  it(
    "leaves main ownership unchanged when the integration destination already exists",
    () => {
      const { root, script, git } = integrationFixture();

      mkdirSync(join(root, ".worktrees/integration"));
      writeFileSync(join(root, ".worktrees/integration/unfinished"), "preserved");
      const result = runNode([script, "setup-integration"]);
      expect(result.status).toBe(1);
      expect(git(["branch", "--show-current"])).toBe("main");
      expect(readFileSync(join(root, ".worktrees/integration/unfinished"), "utf8")).toBe("preserved");
    },
    ciTimeout(20000),
  );

  it.skipIf(process.platform === "win32")(
    "integrates and removes a checkout whose path Git would quote",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture("é space-\n");

      const result = integrate();
      expect(result.status, result.stderr).toBe(0);
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
      expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
      expect(existsSync(taskPath)).toBe(false);
    },
    ciTimeout(20000),
  );

  it.each(["main", "task"])(
    "preserves an unfinished bisect in the %s checkout",
    (checkout) => {
      const { root, taskPath, git, integrate } = integrationFixture();

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
    ciTimeout(20000),
  );

  it.skipIf(process.platform === "win32")(
    "preserves work hidden by a stale Git filesystem monitor",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();

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
    ciTimeout(20000),
  );

  it(
    "checks both sides of a committed rename before integration",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();
      const paths = join(root, ".git", "checked-paths.json");

      git(["mv", "shared.txt", "renamed.txt"], taskPath);
      git(["commit", "-qm", "test: move source"], taskPath);
      const result = integrate({ INTEGRATION_PATHS: paths });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(readFileSync(paths, "utf8"))).toEqual(["renamed.txt", "shared.txt", "task.txt"]);
    },
    ciTimeout(20000),
  );

  it(
    "checks the combined result before advancing main and preserves main on a failed check",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();
      const proof = join(tmpdir(), `alchemy-proof-${process.pid}-${Date.now()}`);
      using _scopeCleanup = createCleanup(() => {
        rmSync(proof, { force: true });
      });

      writeFileSync(join(root, "main.txt"), "main\n");
      git(["add", "main.txt"]);
      git(["commit", "-qm", "test: concurrent main change"]);
      const before = git(["rev-parse", "main"]);
      const failed = integrate({ INTEGRATION_FAIL: "1" });
      expect(failed.status, failed.stderr).toBe(1);
      const attemptDirectory = join(root, "reports/integrations/attempts");
      const attempts = readdirSync(attemptDirectory);
      expect(attempts).toHaveLength(1);
      const attempt = JSON.parse(readFileSync(join(attemptDirectory, attempts[0]), "utf8"));
      expect(attempt).toMatchObject({ task: "task", status: "failed", phase: "verification", attempts: 1 });
      expect(attempt.reason).toContain("Integration verification failed");
      expect(attempt.elapsedMs).toBeGreaterThanOrEqual(attempt.verificationMs);
      expect(existsSync(join(root, "reports/integrations/task.json"))).toBe(false);
      expect(git(["rev-parse", "main"])).toBe(before);
      const passed = integrate({ INTEGRATION_PROOF: proof });
      expect(passed.status, passed.stderr).toBe(0);
      expect(readFileSync(proof, "utf8")).toBe("main\ntask\n");
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
      expect(existsSync(taskPath)).toBe(false);
      expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
    },
    ciTimeout(20000),
  );

  it.skipIf(process.platform === "win32")(
    "does not overwrite state or follow a symlink while recording a failure",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();
      const external = mkdtempSync(join(tmpdir(), "alchemy-attempt-external-"));
      using _scopeCleanup = createCleanup(() => {
        rmSync(root, { recursive: true, force: true });
        rmSync(external, { recursive: true, force: true });
      });
      const directory = join(root, "reports/integrations");
      mkdirSync(directory, { recursive: true });
      const statePath = join(directory, "task.json");
      const savedState = JSON.stringify({ integration: "passed", cleanup: "pending", commit: "prior" });
      writeFileSync(statePath, savedState);
      symlinkSync(external, join(directory, "attempts"));
      const before = git(["rev-parse", "main"]);
      const failed = integrate({ INTEGRATION_FAIL: "1" });
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain("Integration verification failed");
      expect(failed.stderr).toContain("Could not record failed integration attempt");
      expect(readFileSync(statePath, "utf8")).toBe(savedState);
      expect(readdirSync(external)).toEqual([]);
      expect(git(["rev-parse", "main"])).toBe(before);
      expect(existsSync(taskPath)).toBe(true);
    },
    ciTimeout(20000),
  );

  it(
    "keeps source documentation available to the combined integration link gate while omitting masters",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture("docs-", { codeOnlyDocumentation: true });

      const proof = join(root, ".git/documentation-proof.json");
      const expectedCwd = realpathSync(taskPath);
      writeFileSync(join(root, "main.txt"), "concurrent main\n");
      git(["add", "main.txt"]);
      git(["commit", "-qm", "test: advance main before documentation verification"]);

      const result = integrate({ INTEGRATION_DOCUMENTATION_PROOF: proof });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(readFileSync(proof, "utf8"))).toEqual({
        cwd: expectedCwd,
        documentationLinksPassed: true,
        mastersOmitted: true,
      });
      expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
      expect(readFileSync(join(root, "assets/sources/master.png"), "utf8")).toBe("master");
    },
    ciTimeout(20000),
  );

  it.each(["main", "task"])(
    "refuses a %s checkout detached at the same commit during verification",
    (checkout) => {
      const { root, taskPath, git, integrate } = integrationFixture();

      const before = git(["rev-parse", "main"]);
      const result = integrate({ INTEGRATION_DETACH: checkout === "main" ? root : taskPath });
      expect(result.status, result.stdout).toBe(1);
      expect(result.stderr).toContain("expected branch");
      expect(git(["rev-parse", "main"])).toBe(before);
      expect(git(["rev-parse", "HEAD"])).toBe(before);
      expect(existsSync(join(root, "task.txt"))).toBe(false);
    },
    ciTimeout(20000),
  );

  it(
    "refuses dirty main and preserves a conflicting merge in the task worktree",
    () => {
      const { root, taskPath, git, integrate } = integrationFixture();

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
    },
    ciTimeout(20000),
  );

  it(
    "excludes a second integrator and releases the lock after an interrupted owner",
    async () => {
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
        const busy = runNode([join(taskPath, "scripts", "agent-worktree.mjs"), "integrate", "--task", "task"], {
          env: { ...process.env, ALCHEMY_LOCK_WAIT_MS: "0" },
        });
        expect(busy.status).toBe(1);
        expect(busy.stderr).toContain("Task integration lock busy");
        const attemptDirectory = join(root, "reports/integrations/attempts");
        const attempt = JSON.parse(readFileSync(join(attemptDirectory, readdirSync(attemptDirectory)[0]), "utf8"));
        expect(attempt).toMatchObject({ status: "failed", phase: "task lock", attempts: 0 });
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
        rmSync(signals, { recursive: true, force: true });
      }
    },
    ciTimeout(20000),
  );

  it.each(["verification", "cleanup"])(
    "allows another task to integrate during %s and preserves the combined result",
    async (phase) => {
      const { root, script, taskPath, git, archive, run } = integrationFixture();
      const signals = mkdtempSync(join(tmpdir(), "alchemy-integration-concurrency-"));
      const ready = join(signals, "ready");
      const release = join(signals, "release");
      const checks = join(signals, "checks");
      if (phase === "cleanup") {
        writeFileSync(
          join(taskPath, "scripts/lib/agent-browser-session.mjs"),
          `import fs from 'node:fs'; import { setTimeout } from 'node:timers/promises';
export async function closeTaskBrowsers() {
  if (!process.env.INTEGRATION_READY) return;
  fs.writeFileSync(process.env.INTEGRATION_READY, 'ready');
  while (!fs.existsSync(process.env.INTEGRATION_RELEASE)) await setTimeout(20);
}`,
        );
        git(["add", "scripts/lib/agent-browser-session.mjs"], taskPath);
        git(["commit", "-qm", "test: gate cleanup"], taskPath);
      }
      const peer = join(root, ".worktrees", "peer");
      git(["worktree", "add", "-b", "agent/peer", peer]);
      writeFileSync(join(peer, "peer.txt"), "peer\n");
      if (phase === "verification") {
        const launcher = join(peer, "scripts/lib/command-invocation.mjs");
        writeFileSync(
          launcher,
          readFileSync(launcher, "utf8") +
            "\nif (process.env.INTEGRATION_CHECKS) fs.writeFileSync(process.env.INTEGRATION_CHECKS + '.launcher', 'updated');\n",
        );
      }
      git(["add", "peer.txt", "scripts/lib/command-invocation.mjs"], peer);
      git(["commit", "-qm", "test: peer change"], peer);
      // The cleanup case gates only the browser module, not the check runner.
      if (phase === "cleanup") {
        const check = readFileSync(join(taskPath, "check.cjs"), "utf8").replace(
          "if (process.env.INTEGRATION_READY)",
          "if (false)",
        );
        writeFileSync(join(taskPath, "check.cjs"), check);
        git(["add", "check.cjs"], taskPath);
        git(["commit", "-qm", "test: gate only cleanup"], taskPath);
      }
      if (phase === "cleanup") {
        const integrated = runNode([script, "integrate", "--task", "task", "--keep-worktree"], {
          env: { ...process.env, INTEGRATION_CHECKS: checks },
        });
        expect(integrated.status, integrated.stderr).toBe(0);
      }
      const child = spawn(
        process.execPath,
        [
          script,
          phase === "cleanup" ? "finish" : "integrate",
          "--task",
          "task",
          ...(phase === "verification" ? ["--keep-worktree"] : []),
        ],
        {
          env: {
            ...process.env,
            CODEX_WORKTREE_ARCHIVE_ROOT: archive,
            INTEGRATION_READY: ready,
            INTEGRATION_RELEASE: release,
            INTEGRATION_CHECKS: checks,
          },
          stdio: "pipe",
        },
      );
      let output = "";
      child.stdout.on("data", (data) => {
        output += data;
      });
      child.stderr.on("data", (data) => {
        output += data;
      });
      const closed = new Promise<number | null>((resolve) => {
        child.once("close", resolve);
      });
      try {
        const deadline = Date.now() + 10000;
        while (!existsSync(ready) && Date.now() < deadline && child.exitCode === null)
          await new Promise((resolve) => {
            setTimeout(resolve, 20);
          });
        expect(existsSync(ready), output).toBe(true);
        const peerResult = run(["integrate", "--task", "peer"], { ALCHEMY_LOCK_WAIT_MS: "0" });
        expect(peerResult.status, peerResult.stdout + peerResult.stderr).toBe(0);
        writeFileSync(release, "release");
        expect(await closed, output).toBe(0);
        if (phase === "verification") {
          const finished = run(["finish", "--task", "task"]);
          expect(finished.status, finished.stderr).toBe(0);
        }
        expect(readFileSync(join(root, "peer.txt"), "utf8")).toBe("peer\n");
        expect(readFileSync(join(root, "task.txt"), "utf8")).toBe("task\n");
        expect(existsSync(taskPath)).toBe(false);
        const observed = readFileSync(checks, "utf8").trim().split("\n");
        expect(new Set(observed).size).toBe(phase === "verification" ? 2 : 1);
        if (phase === "verification") {
          expect(output).toContain("Main advanced during verification");
          expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8")).metrics.attempts).toBe(
            2,
          );
          expect(readFileSync(checks + ".launcher", "utf8")).toBe("updated");
        }
      } finally {
        writeFileSync(release, "release");
        if (child.exitCode === null) child.kill("SIGKILL");
        await closed;
        rmSync(root, { recursive: true, force: true });
        rmSync(signals, { recursive: true, force: true });
      }
    },
    ciTimeout(20000),
  );
});

it(
  "preserves check evidence and captures before deleting outputs, retaining the branch and leaving peers untouched",
  () => {
    const { root, taskPath, git, integrate, archive } = integrationFixture();

    writeFileSync(join(root, "main.txt"), "main\n");
    git(["add", "main.txt"]);
    git(["commit", "-qm", "test: main"]);
    writeFileSync(join(taskPath, ".gitignore"), ".worktrees/\nreports/\nignored\nnode_modules/\n.cache/\n");
    git(["add", ".gitignore"], taskPath);
    git(["commit", "-qm", "test: ignore outputs"], taskPath);
    writeFileSync(join(taskPath, "ignored"), "local evidence");
    mkdirSync(join(taskPath, "node_modules"));
    writeFileSync(join(taskPath, "node_modules", "cached"), "rebuildable");
    mkdirSync(join(taskPath, "scripts/trailers/node_modules"), { recursive: true });
    writeFileSync(join(taskPath, "scripts/trailers/node_modules/tool"), "rebuildable");
    mkdirSync(join(taskPath, ".cache/lyrics/venv"), { recursive: true });
    writeFileSync(join(taskPath, ".cache/lyrics/venv/tool"), "rebuildable");
    mkdirSync(join(taskPath, "reports/boss-lyrics/venv"), { recursive: true });
    writeFileSync(join(taskPath, "reports/boss-lyrics/venv/tool"), "rebuildable");
    writeFileSync(join(taskPath, "reports/boss-lyrics/alignment.json"), "retained evidence");
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
    const bundles = readdirSync(join(root, "reports/integrations")).filter((entry) => !entry.endsWith(".json"));
    expect(bundles).toHaveLength(1);
    const evidence = join(root, "reports/integrations", bundles[0]);
    expect(readFileSync(join(evidence, "reports/runs/check-test/run.md"), "utf8")).toBe("passing integration check");
    expect(readFileSync(join(evidence, "reports/runs/reused-test/output.log"), "utf8")).toBe(
      "original verification evidence",
    );
    expect(readFileSync(join(evidence, "reports/visual-review/screen.png"), "utf8")).toBe("selected capture");
    expect(readFileSync(join(evidence, "ignored"), "utf8")).toBe("local evidence");
    expect(existsSync(join(evidence, "node_modules"))).toBe(false);
    expect(existsSync(join(evidence, "scripts/trailers/node_modules"))).toBe(false);
    expect(existsSync(join(evidence, ".cache"))).toBe(false);
    expect(existsSync(join(evidence, "reports/boss-lyrics/venv"))).toBe(false);
    expect(readFileSync(join(evidence, "reports/boss-lyrics/alignment.json"), "utf8")).toBe("retained evidence");
    expect(result.stdout).toContain("Cleanup preview:");
    expect(JSON.parse(readFileSync(join(evidence, "integration.json"), "utf8")).commit).toBe(
      git(["rev-parse", "main"]),
    );
    expect(JSON.parse(readFileSync(join(evidence, "integration.json"), "utf8")).retentionPolicy).toBe(
      "managed-runs-v1",
    );
    expect(readFileSync(join(root, "reports/browser-closed"), "utf8")).toBe("closed");
    expect(result.stdout).toContain("Preserved integration evidence:");
  },
  ciTimeout(20000),
);

it.skipIf(process.platform === "win32").each(["escaping artifact", "symlink"])(
  "preserves the integrated checkout when evidence contains an %s",
  (entry) => {
    const { root, taskPath, git, integrate, run } = integrationFixture();

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
    expect(result.stderr).toContain("Integration remains complete; cleanup blocked");
    expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8"))).toMatchObject({
      integration: "passed",
      cleanup: "blocked",
    });
    expect(existsSync(taskPath)).toBe(true);
    expect(readFileSync(join(root, "shared.txt"), "utf8")).toBe("base\n");
    expect(git(["rev-parse", "main"])).toBe(git(["rev-parse", "agent/task"]));
    const status = run(["status", "--task", "task"]);
    expect(status.stdout).toContain("Cleanup blocked:");
    expect(status.stdout).toContain("Resolve the reported condition");
    if (entry === "symlink") rmSync(join(taskPath, "reports/visual-review/linked.txt"));
    else rmSync(join(taskPath, "reports/current-run.json"));
    const retry = run(["finish", "--task", "task"]);
    expect(retry.status, retry.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8")).cleanup).toBe("passed");
  },
  ciTimeout(20000),
);

it(
  "automatically preserves evidence and removes an integrated task while retaining its branch",
  () => {
    const { root, taskPath, git, run } = integrationFixture();

    writeFileSync(join(root, "main.txt"), "main\n");
    mkdirSync(join(taskPath, "reports/visual-review"), { recursive: true });
    writeFileSync(join(taskPath, "reports/visual-review/evidence.txt"), "keep this evidence");
    git(["add", "main.txt"]);
    git(["commit", "-qm", "test: main"]);
    const result = run(["integrate", "--task", "task"]);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(taskPath)).toBe(false);
    const state = JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8"));
    expect(state).toMatchObject({
      integration: "passed",
      cleanup: "passed",
    });
    expect(readFileSync(join(state.evidence, "reports/visual-review/evidence.txt"), "utf8")).toBe("keep this evidence");
    expect(git(["rev-parse", "agent/task"])).toBe(state.commit);
    expect(result.stdout).toContain(`git diff ${state.reviewBase} ${state.commit}`);
  },
  ciTimeout(20000),
);

it(
  "retains an integrated checkout when explicitly requested and flags it for review",
  () => {
    const { root, taskPath, script, run } = integrationFixture();

    const result = run(["integrate", "--task", "task", "--keep-worktree"]);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(taskPath)).toBe(true);
    expect(JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8")).cleanup).toBe("pending");
    const listed = runNode([script, "list"]);
    expect(listed.stdout).toContain("task: pending");
    expect(listed.stdout).toContain("activity is not inferred");
  },
  ciTimeout(20000),
);

it(
  "does not automatically finish a checkout containing trailer output",
  () => {
    const { root, taskPath, run } = integrationFixture();

    writeFileSync(join(root, ".git/info/exclude"), "output/\n");
    mkdirSync(join(taskPath, "output/trailers"), { recursive: true });
    writeFileSync(join(taskPath, "output/trailers/footage.mp4"), "working footage");
    const result = run(["integrate", "--task", "task"]);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(taskPath, "output/trailers/footage.mp4"), "utf8")).toBe("working footage");
    expect(result.stdout).toContain("Trailer worktree retained");
  },
  ciTimeout(20000),
);

it(
  "reports cleanup failure separately and preserves the integrated checkout",
  () => {
    const { root, taskPath, script, git, run } = integrationFixture();

    mkdirSync(join(taskPath, "reports/visual-review"), { recursive: true });
    symlinkSync(join(root, "shared.txt"), join(taskPath, "reports/visual-review/linked.txt"));
    const result = run(["integrate", "--task", "task"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Integration remains complete; cleanup blocked");
    const state = JSON.parse(readFileSync(join(root, "reports/integrations/task.json"), "utf8"));
    expect(state).toMatchObject({ integration: "passed", cleanup: "blocked" });
    expect(git(["rev-parse", "main"])).toBe(state.commit);
    expect(existsSync(taskPath)).toBe(true);
    const listed = runNode([script, "list"]);
    expect(listed.stdout).toContain("task: blocked");
  },
  ciTimeout(20000),
);

it("verifies automatic storage defaults and independent tracked clones", { timeout: ciTimeout(30_000) }, () => {
  const result = runNode(
    [
      join(process.cwd(), "tests/fixtures/worktree-storage-check.mjs"),
      join(process.cwd(), "scripts/lib/worktree-storage.mjs"),
    ],
    { timeout: 25_000 },
  );
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

function ciTimeout(ms: number) {
  return process.env.CI ? 0 : ms;
}
