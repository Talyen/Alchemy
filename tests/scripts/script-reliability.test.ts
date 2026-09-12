import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commandInvocation } from "../../scripts/lib/command-invocation.mjs";
import { runCommand, runCommandAsync } from "../../scripts/lib/run-command.mjs";
import { resolvePushPaths } from "../../scripts/lib/changed-paths.mjs";
import { changedGitPaths } from "../../scripts/lib/current-run.mjs";
import { resolveRoutePlan } from "../../scripts/lib/change-routes.mjs";
import { validateTestSuitePaths } from "../../scripts/lib/test-commands.mjs";
import { runAudits } from "../../scripts/audit-all.mjs";
import { parsePerformanceArgs } from "../../scripts/run-performance.mjs";
import { parseSyncArgs } from "../../scripts/sync-generated.mjs";

const ROOT = process.cwd();
const temporary: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-scripts-"));
  temporary.push(root);
  return root;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of temporary.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function git(root: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LEFTHOOK: "0" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}
function repository() {
  const root = fixture();
  git(root, "init", "-q");
  git(root, "config", "user.email", "scripts@example.invalid");
  git(root, "config", "user.name", "Script tests");
  fs.writeFileSync(path.join(root, "game.ts"), "original");
  commit(root);
  return root;
}
function commit(root: string) {
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return git(root, "rev-parse", "HEAD");
}

function descendantCommand(root: string) {
  const marker = path.join(root, "descendant-survived");
  const ready = path.join(root, "descendant-ready");
  const descendant = `console.log('descendant ready'); require('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready'); setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'survived'), 1000); setTimeout(() => process.exit(0), 2000);`;
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], {stdio: 'inherit'}); setInterval(() => {}, 1000);`;
  return { marker, ready, parent };
}

describe("script execution reliability", () => {
  it("resolves installed tools through Node and never downloads unknown tools", () => {
    for (const tool of ["vitest", "playwright", "eslint", "depcruise", "commit-and-tag-version"]) {
      const [executable, args] = commandInvocation("npx", [tool, "--version"]);
      expect(executable).toBe(process.execPath);
      expect(fs.existsSync(args[0])).toBe(true);
      expect(args.slice(1)).toEqual(["--version"]);
    }
    expect(() => commandInvocation("npx", ["not-installed"])).toThrow("Unsupported local CLI");
    const result = runCommand("npm", ["--version"]);
    expect(result.status, result.output).toBe(0);
    expect(result.output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("preserves literal subprocess arguments without shell interpretation", async () => {
    const args = ["space in path", "Options|Auto-End", '"quoted"', "a&b"];
    for (const runner of [runCommand, runCommandAsync]) {
      const result = await runner(process.execPath, [
        "-e",
        "console.log(JSON.stringify(process.argv.slice(1)))",
        "--",
        ...args,
      ]);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.output)).toEqual(args);
    }
  });

  it("fails the ship gate when its test process is interrupted", () => {
    const source = `import cp from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      cp.spawnSync = () => ({status:null,signal:'SIGTERM'});
      syncBuiltinESMExports();
      await import('./scripts/run-ship-unit.mjs');`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd: ROOT, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(1);
  });

  it("captures large successful output in memory and retains full file-backed failure evidence", async () => {
    const code = 'require("node:fs").writeSync(1, "x".repeat(2 * 1024 * 1024)); console.error("LAST ERROR");';
    expect(runCommand(process.execPath, ["-e", code], { shell: false }).status).toBe(0);
    for (const runner of [runCommand, runCommandAsync]) {
      const logPath = path.join(fixture(), "command.log");
      const result = await runner(process.execPath, ["-e", code + "process.exitCode = 7"], {
        shell: false,
        logPath,
        maxBuffer: 4096,
      });
      expect(result.status).toBe(7);
      expect(result.outputTruncated).toBe(true);
      expect(result.output).toContain("LAST ERROR");
      expect(result.output.length).toBeLessThan(4500);
      expect(fs.readFileSync(logPath, "utf8")).toHaveLength(2 * 1024 * 1024 + 11);
    }
  });

  it("returns failure on spawn errors and timeouts with file capture", async () => {
    const logPath = path.join(fixture(), "command.log");
    const missing = await runCommandAsync(path.join(fixture(), "missing-command"), [], { shell: false, logPath });
    expect(missing.status).toBeNull();
    expect(missing.error).toBeDefined();
    const timeout = await runCommandAsync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      shell: false,
      logPath,
      timeout: 200,
    });
    expect(timeout.timedOut).toBe(true);
    expect(timeout.status).toBeNull();
  });

  it.each(["-C", "--work-tree"])("backs up the selected checkout for %s without altering the caller", (option) => {
    const caller = repository();
    const target = repository();
    fs.writeFileSync(path.join(target, "game.ts"), "target work");
    const prelude =
      option === "-C" ? ["-C", target, "-C", "."] : ["--git-dir", path.join(target, ".git"), "--work-tree", target];
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "scripts/git-safety-guard.mjs"), ...prelude, "reset", "--hard"],
      {
        cwd: caller,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("blocked: destructive git command");
    expect(git(target, "show", "stash@{0}:game.ts")).toBe("target work");
    expect(git(caller, "stash", "list")).toBe("");
    expect(fs.readFileSync(path.join(caller, "game.ts"), "utf8")).toBe("original");
  });

  it("preserves caller-supplied Git configuration when forwarding safe commands", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "scripts/git-safety-guard.mjs"), "config", "--get", "review.marker"],
      {
        cwd: repository(),
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "review.marker",
          GIT_CONFIG_VALUE_0: "preserved",
        },
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("preserved");
  });

  it.each([false, true])("stops descendants at the deadline (file capture: %s)", async (fileCapture) => {
    const root = fixture();
    const { marker, parent } = descendantCommand(root);
    const result = await runCommandAsync(process.execPath, ["-e", parent], {
      shell: false,
      timeout: 500,
      ...(fileCapture ? { logPath: path.join(root, "command.log") } : {}),
    });
    expect(result.output).toContain("descendant ready");
    expect(result.timedOut).toBe(true);
    expect(result.status).toBeNull();
    await delay(1200);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("stops active command trees when the runner receives an interrupt", async () => {
    const root = fixture();
    const { marker, ready, parent } = descendantCommand(root);
    const runnerUrl = pathToFileURL(path.join(ROOT, "scripts/lib/run-command.mjs")).href;
    const source = `import fs from "node:fs";
      import {runCommandAsync} from ${JSON.stringify(runnerUrl)};
      runCommandAsync(process.execPath, ['-e', ${JSON.stringify(parent)}], {shell:false, stdio:'inherit'});
      // Signal only after the descendant starts, even under concurrent test load.
      const readyCheck = setInterval(() => {
        if (fs.existsSync(${JSON.stringify(ready)})) {
          clearInterval(readyCheck);
          process.emit('SIGINT');
        }
      }, 10);`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      encoding: "utf8",
      timeout: 5_000,
    });
    expect(result.stdout).toContain("descendant ready");
    expect(result.status).toBe(130);
    await delay(1200);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("retains a renamed file's original risk selection and exact path spelling", () => {
    const root = repository();
    const old = "src/features/alchemy/shared/storage/example.ts";
    const next = "src/lib/example.ts";
    fs.mkdirSync(path.dirname(path.join(root, old)), { recursive: true });
    fs.mkdirSync(path.dirname(path.join(root, next)), { recursive: true });
    fs.writeFileSync(path.join(root, old), "export const value = 1;");
    commit(root);
    fs.renameSync(path.join(root, old), path.join(root, next));
    git(root, "add", ".");
    fs.writeFileSync(path.join(root, " spaced.ts"), "untracked");
    const selected = changedGitPaths(root);
    expect(selected).toEqual(expect.arrayContaining([old, next, " spaced.ts"]));
    expect(resolveRoutePlan(selected ?? []).commands.map((command) => command.key)).toContain("unit-save");
  });

  it("keeps deleted paths for verification while fallback search reads only surviving files", () => {
    const root = repository();
    fs.unlinkSync(path.join(root, "game.ts"));
    fs.writeFileSync(path.join(root, "alive.ts"), "needle");
    const source = `import cp from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      const spawn = cp.spawnSync;
      cp.spawnSync = (command, ...args) => command === 'rg'
        ? {error: Object.assign(new Error('missing rg'), {code:'ENOENT'})} : spawn(command, ...args);
      syncBuiltinESMExports();
      const {repositorySearch} = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "scripts/lib/agent-discovery.mjs")).href)});
      const {expandRepositoryPaths} = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "scripts/lib/repository-paths.mjs")).href)});
      const root = ${JSON.stringify(root)};
      console.log(JSON.stringify({selected: expandRepositoryPaths(root, ['.']), found: repositorySearch(root, {pattern: 'needle'})}));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ selected: ["alive.ts", "game.ts"], found: ["alive.ts"] });
  });

  it("leaves dirty work and the stash untouched for a Git clean dry run", () => {
    const root = repository();
    fs.writeFileSync(path.join(root, "game.ts"), "work in progress");
    fs.writeFileSync(path.join(root, "untracked.txt"), "keep me");
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/git-safety-guard.mjs"), "clean", "-ndf"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(root, "game.ts"), "utf8")).toBe("work in progress");
    expect(fs.readFileSync(path.join(root, "untracked.txt"), "utf8")).toBe("keep me");
    expect(git(root, "stash", "list")).toBe("");
  });

  it("selects all outgoing changes and rejects uncommitted inputs except for ref deletions", () => {
    const root = repository();
    const base = git(root, "rev-parse", "HEAD");
    fs.renameSync(path.join(root, "game.ts"), path.join(root, "renamed.ts"));
    commit(root);
    fs.writeFileSync(path.join(root, "README.md"), "docs");
    const head = commit(root);
    fs.writeFileSync(path.join(root, "unrelated.md"), "dirty");
    const input = `refs/heads/main ${head} refs/heads/main ${base}\n`;
    expect(() => resolvePushPaths(root, input)).toThrow("clean checkout");
    expect(resolvePushPaths(root, `(delete) ${"0".repeat(40)} refs/heads/old ${base}\n`)).toEqual([]);
    fs.unlinkSync(path.join(root, "unrelated.md"));
    fs.writeFileSync(path.join(root, "renamed.ts"), "uncommitted fix");
    expect(() => resolvePushPaths(root, input)).toThrow("clean checkout");
    git(root, "add", ".");
    expect(() => resolvePushPaths(root, input)).toThrow("clean checkout");
    fs.writeFileSync(path.join(root, "renamed.ts"), "original");
    git(root, "add", ".");
    expect(resolvePushPaths(root, input)).toEqual(["README.md", "game.ts", "renamed.ts"]);
    expect(resolvePushPaths(root, input + input)).toHaveLength(3);
    expect(resolvePushPaths(root, `refs/heads/new ${head} refs/heads/new ${"0".repeat(40)}\n`)).toEqual([
      "README.md",
      "renamed.ts",
    ]);
    expect(resolvePushPaths(root, `(delete) ${"0".repeat(40)} refs/heads/old ${base}\n`)).toEqual([]);
    expect(() => resolvePushPaths(root, `refs/heads/old ${base} refs/heads/old ${"0".repeat(40)}\n`)).toThrow(
      "Check out",
    );
    expect(() => resolvePushPaths(root, `refs/heads/main ${head} refs/heads/main ${"f".repeat(40)}\n`)).toThrow(
      "Could not inspect",
    );
  });

  it("retains successful advisory findings in the audit report and terminal summary", async () => {
    const rootDir = fixture();
    vi.stubEnv("ALCHEMY_RUN_ID", "audit-findings-test");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const runner = vi.fn(async () => ({ status: 0, elapsedMs: 1, output: "Advisory finding: 12 escapes" }));
    expect(await runAudits([], { rootDir, runner })).toBe(0);
    const reportDir = path.join(rootDir, "reports/runs/audit-findings-test/audit");
    expect(fs.readFileSync(path.join(reportDir, "summary.md"), "utf8")).toContain("Advisory finding: 12 escapes");
    expect(fs.readdirSync(reportDir).filter((file) => file.endsWith(".log"))).toHaveLength(6);
    expect(log.mock.calls.flat().join("\n")).toContain("Advisory finding: 12 escapes");
  });

  it("rejects typos, missing values and conflicting CLI modes before work begins", () => {
    expect(() => parseSyncArgs(["--chek"])).toThrow("Unknown sync option");
    expect(() => parseSyncArgs(["--gear-only", "--art-only"])).toThrow("Choose only one");
    expect(parseSyncArgs(["--check", "--gear-only"])).toMatchObject({ check: true, gearOnly: true });
    for (const argv of [
      ["--scenaro", "battle"],
      ["--scenario"],
      ["--runs", "2x"],
      ["--runs=0"],
      ["--compare", "a"],
      ["--compare", "a", "b", "--all"],
    ])
      expect(() => parsePerformanceArgs(argv)).toThrow();
    expect(parsePerformanceArgs(["--runs", "2"])).toMatchObject({ runs: 2 });
    for (const args of [["prepare"], ["--prepare", "--optimize"], ["--optimize", "--check"]]) {
      const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/assets.mjs"), ...args], {
        encoding: "utf8",
        env: { ...process.env, ALCHEMY_SKIP_ASSETS: "1" },
      });
      expect(result.status, result.stderr).toBe(2);
    }
  });

  it("finds nested TS/TSX suites and rejects missing, empty, and non-test selections", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "nested/deeper"), { recursive: true });
    fs.mkdirSync(path.join(root, "empty"));
    fs.writeFileSync(path.join(root, "nested/deeper/example.test.tsx"), "");
    fs.writeFileSync(path.join(root, "example.test.ts"), "");
    fs.writeFileSync(path.join(root, "helper.ts"), "");
    expect(validateTestSuitePaths(root, ["nested", "example.test.ts", "empty", "missing", "helper.ts"])).toEqual([
      "empty",
      "missing",
      "helper.ts",
    ]);
  });
});

describe("E2E audit outcomes", () => {
  it.each([
    { name: "corrupt JSON", report: "{broken", failed: true },
    { name: "unexpected test", report: JSON.stringify({ suites: [], stats: { unexpected: 1 } }), failed: true },
    {
      name: "setup error",
      report: JSON.stringify({ suites: [], errors: [{ message: "Setup failed" }] }),
      failed: true,
    },
    { name: "passing tests", report: JSON.stringify({ suites: [], stats: { expected: 1 } }), failed: false },
  ])("preserves the outcome of a reused report: $name", ({ report, failed }) => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "reports"));
    fs.writeFileSync(path.join(root, "reports/e2e-results.json"), report);
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/analyze-e2e.mjs"), "--reuse-timings"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ALCHEMY_RUN_ID: "audit-outcome-test" },
      timeout: 10_000,
    });
    expect(result.status, result.stderr).toBe(failed ? 1 : 0);
    const record = JSON.parse(fs.readFileSync(path.join(root, "reports/current-run.json"), "utf8")) as {
      status: string;
    };
    expect(record.status).toBe(failed ? "failed" : "passed");
  });
});
