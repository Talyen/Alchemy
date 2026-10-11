import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commandInvocation, resolveBuilderBin, resolveViteBin } from "../../scripts/lib/command-invocation.mjs";
import { runCommand, runCommandAsync } from "../../scripts/lib/run-command.mjs";
import { resolvePushPaths, resolveSelectedPaths } from "../../scripts/lib/verification/changed-paths.mjs";
import { expandRepositoryPaths, listRepositoryFiles } from "../../scripts/lib/repository-paths.mjs";
import { changedGitPaths } from "../../scripts/lib/verification/current-run.mjs";
import { resolveRoutePlan, resolveRoutes } from "../../scripts/lib/verification/change-routes.mjs";
import { validateTestSuitePaths } from "../../scripts/lib/verification/test-commands.mjs";
import { runAudits } from "../../scripts/audit-all.mjs";
import { parsePerformanceArgs } from "../../scripts/run-performance.mjs";
import { parseSyncArgs } from "../../scripts/sync-generated.mjs";
import { parseAssetArgs } from "../../scripts/assets.mjs";

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

function descendantCommand(root: string, delayMs = 1000) {
  const marker = path.join(root, "descendant-survived");
  const ready = path.join(root, "descendant-ready");
  const descendant = `console.log('descendant ready'); require('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready'); setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'survived'), ${delayMs}); setTimeout(() => process.exit(0), ${delayMs * 2});`;
  const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], {stdio: 'inherit'}); setInterval(() => {}, 1000);`;
  return { marker, ready, parent };
}

describe("script execution reliability", () => {
  it("resolves installed tools through Node and never downloads unknown tools", () => {
    const forwarded = ["--version", "space & literal | argument"];
    for (const [tool, relative] of [
      ["vitest", "vitest/vitest.mjs"],
      ["playwright", "@playwright/test/cli.js"],
      ["oxlint", "oxlint/bin/oxlint"],
      ["depcruise", "dependency-cruiser/bin/dependency-cruiser.mjs"],
      ["commit-and-tag-version", "commit-and-tag-version/bin/cli.js"],
      ["vite", "vite/bin/vite.js"],
      ["electron-builder", "electron-builder/out/cli/cli.js"],
      ["tsc", "typescript/bin/tsc"],
      ["knip", "knip/bin/knip.js"],
      ["concurrently", "concurrently/dist/bin/concurrently.js"],
    ]) {
      const [executable, args] = commandInvocation("npx", [tool, ...forwarded]);
      expect(executable).toBe(process.execPath);
      expect(args[0]).toBe(path.join(ROOT, "node_modules", relative));
      expect(fs.existsSync(args[0])).toBe(true);
      expect(args.slice(1)).toEqual(forwarded);
      expect(commandInvocation(tool, forwarded)).toEqual([executable, args]);
    }
    expect(() => commandInvocation("npx", ["not-installed"])).toThrow("Unsupported local CLI");
    expect(fs.existsSync(resolveBuilderBin())).toBe(true);
    expect(fs.existsSync(resolveViteBin())).toBe(true);
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

  it("preserves UTF-8 characters split across stdout and stderr chunks", async () => {
    const result = await runCommandAsync(process.execPath, [
      "-e",
      `const fs = require('node:fs');
       const bytes = Buffer.from('龍✨');
       fs.writeSync(1, bytes.subarray(0, 1));
       fs.writeSync(2, bytes.subarray(0, 2));
       setTimeout(() => {
         fs.writeSync(1, bytes.subarray(1));
         fs.writeSync(2, bytes.subarray(2));
       }, 50);`,
    ]);
    expect(result.status).toBe(0);
    expect(result.output).toBe("龍✨\n龍✨");
  });

  it("rejects unsupported sync arguments before rewriting changelog or version metadata", () => {
    const root = repository();
    fs.cpSync(path.join(ROOT, "scripts"), path.join(root, "scripts"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, ".versionrc.json"), path.join(root, ".versionrc.json"));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
    const changelog = path.join(root, "CHANGELOG.md");
    const metadata = path.join(root, "src/lib/validation/metadata.generated.ts");
    fs.mkdirSync(path.dirname(metadata), { recursive: true });
    fs.writeFileSync(changelog, "# Changelog\n\n## [Unreleased]\n\n_Stale._\n");
    fs.writeFileSync(metadata, "original metadata");
    const before = [changelog, metadata].map((file) => fs.readFileSync(file, "utf8"));
    for (const script of ["sync-changelog.mjs", "sync-version-metadata.mjs"]) {
      for (const arg of ["--chek", "unexpected", "-x"]) {
        const result = spawnSync(process.execPath, [path.join(root, "scripts", script), arg], {
          cwd: root,
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(2);
        expect([changelog, metadata].map((file) => fs.readFileSync(file, "utf8"))).toEqual(before);
      }
    }
  });

  it("fails the ship gate when its test process is interrupted", () => {
    const source = `import cp from 'node:child_process';
      import net from 'node:net';
      import { syncBuiltinESMExports } from 'node:module';
      net.createServer = () => ({once() {}, listen(_options, ready) { ready(); }, address() { return {port: 0}; }, close(done) { done(); }});
      cp.spawnSync = () => { console.log('interrupted test process'); return {status:null,signal:'SIGTERM'}; };
      syncBuiltinESMExports();
      process.argv.push('--live');
      await import('./scripts/run-ship-unit.mjs');`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd: ROOT, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("interrupted test process");
    expect(result.stderr).not.toContain("Local test lane is occupied");
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

  it.skipIf(process.platform === "win32")(
    "backs up work hidden by a stale filesystem monitor before blocking reset",
    () => {
      const root = repository();
      const monitor = path.join(root, ".git", "silent-fsmonitor");
      fs.writeFileSync(monitor, "#!/bin/sh\nprintf 'stale-token\\0'\n", { mode: 0o755 });
      git(root, "config", "core.fsmonitor", monitor);
      git(root, "config", "core.untrackedCache", "true");
      git(root, "status", "--porcelain");
      fs.writeFileSync(path.join(root, "game.ts"), "unsaved work");
      expect(git(root, "status", "--porcelain", "--untracked-files=all")).toBe("");

      const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/git-safety-guard.mjs"), "reset", "--hard"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, LEFTHOOK: "0" },
      });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("blocked: destructive git command");
      expect(git(root, "show", "stash@{0}:game.ts")).toBe("unsaved work");
      expect(git(root, "config", "core.fsmonitor")).toBe(monitor);
      expect(git(root, "config", "core.untrackedCache")).toBe("true");
    },
  );

  it.each([false, true])("stops descendants at the deadline (file capture: %s)", async (fileCapture) => {
    const root = fixture();
    const { marker, parent } = descendantCommand(root, 500);
    const result = await runCommandAsync(process.execPath, ["-e", parent], {
      shell: false,
      timeout: 250,
      ...(fileCapture ? { logPath: path.join(root, "command.log") } : {}),
    });
    expect(result.output).toContain("descendant ready");
    expect(result.timedOut).toBe(true);
    expect(result.status).toBeNull();
    await delay(350);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("stops active command trees when the runner receives an interrupt", async () => {
    const root = fixture();
    const { marker, ready, parent } = descendantCommand(root, 500);
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
    await delay(600);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("stops nested command runners and their separate process groups at the outer deadline", async () => {
    const root = fixture();
    const marker = path.join(root, "nested-survived");
    const runnerUrl = pathToFileURL(path.join(ROOT, "scripts/lib/run-command.mjs")).href;
    const descendant = `console.log('nested ready:' + Date.now()); setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'survived'), 1500);`;
    const nested = `import {runCommandAsync} from ${JSON.stringify(runnerUrl)};
      await runCommandAsync(process.execPath, ['-e', ${JSON.stringify(descendant)}], {stdio:'inherit'});`;
    const result = await runCommandAsync(process.execPath, ["--input-type=module", "-e", nested], {
      timeout: 1000,
      logPath: path.join(root, "outer.log"),
    });
    expect(result.output).toContain("nested ready");
    expect(result.timedOut).toBe(true);
    const readyAt = Number(/nested ready:(\d+)/u.exec(result.output)?.[1]);
    await delay(Math.max(0, readyAt + 1800 - Date.now()));
    expect(fs.existsSync(marker)).toBe(false);
  });

  it.each(["HEAD", "status", "source"])(
    "rejects an unverifiable %s instead of issuing a passing source digest",
    (failure) => {
      const source = `import cp from 'node:child_process';
      import fs from 'node:fs';
      import {syncBuiltinESMExports} from 'node:module';
      cp.spawnSync = (_command, args) => args.includes('rev-parse')
        ? {status: ${failure === "HEAD" ? 1 : 0}, stdout:'abc', stderr:'cannot read HEAD'}
        : {status: ${failure === "status" ? 1 : 0}, stdout:' M game.ts\\0', stderr:'cannot inspect checkout'};
      fs.lstatSync = () => { throw Object.assign(new Error('cannot read source'), {code:'EACCES'}); };
      syncBuiltinESMExports();
      const {captureSourceDigest} = await import('./scripts/check.mjs');
      try { captureSourceDigest(); process.exitCode = 9; }
      catch (error) { console.log(error.message); }`;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: ROOT,
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/cannot|Could not/);
    },
  );

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

  it("discovers new tests after warming Git caches without changing repository settings", () => {
    const root = repository();
    const directory = "tests/lib";
    fs.mkdirSync(path.join(root, directory), { recursive: true });
    fs.writeFileSync(path.join(root, directory, "existing.test.ts"), "existing");
    fs.writeFileSync(path.join(root, ".gitignore"), "ignored.test.ts\n");
    const head = commit(root);
    git(root, "config", "core.untrackedCache", "true");
    git(root, "config", "core.fsmonitor", "true");
    try {
      for (let index = 0; index < 3; index += 1) git(root, "status", "--short", "--untracked-files=all");
      const added = `${directory}/new é space.test.ts`;
      fs.writeFileSync(path.join(root, added), "new test");
      fs.writeFileSync(path.join(root, "ignored.test.ts"), "ignored");
      fs.unlinkSync(path.join(root, "game.ts"));
      expect(changedGitPaths(root)?.sort()).toEqual(["game.ts", added].sort());
      expect(resolveSelectedPaths(root, { paths: [] }).sort()).toEqual(["game.ts", added].sort());
      expect(expandRepositoryPaths(root, [directory])).toContain(added);
      expect(listRepositoryFiles(root)).not.toContain("ignored.test.ts");
      expect(resolveRoutes([added]).flatMap((route) => route.commands)).toContain("unit-changed");
      // Untracked source alone must also reject a pre-push check.
      fs.writeFileSync(path.join(root, "game.ts"), "original");
      expect(() => resolvePushPaths(root, `refs/heads/main ${head} refs/heads/main ${"0".repeat(40)}\n`)).toThrow(
        "clean checkout",
      );
      expect(git(root, "config", "--get", "core.fsmonitor")).toBe("true");
      expect(git(root, "config", "--get", "core.untrackedCache")).toBe("true");
    } finally {
      spawnSync("git", ["fsmonitor--daemon", "stop"], { cwd: root, stdio: "ignore" });
    }
  });

  it("fails verification discovery explicitly when Git cannot read the repository", () => {
    const root = fixture();
    expect(changedGitPaths(root)).toBeNull();
    expect(() => resolveSelectedPaths(root, { paths: [] })).toThrow("git status failed");
    expect(() => listRepositoryFiles(root)).toThrow("Could not list repository files");
    expect(() => resolvePushPaths(root, "")).toThrow("Could not inspect push revisions");
  });

  it("keeps working-tree selection focused and supports clean shallow checkouts", () => {
    const root = repository();
    fs.writeFileSync(path.join(root, "history.ts"), "history");
    commit(root);
    fs.writeFileSync(path.join(root, "game.ts"), "modified");
    fs.writeFileSync(path.join(root, "staged.ts"), "staged");
    git(root, "add", "staged.ts");
    fs.writeFileSync(path.join(root, "untracked.ts"), "untracked");
    const diff = new Set(["diff"]);
    expect(resolveSelectedPaths(root, { paths: [] }).sort()).toEqual(["game.ts", "staged.ts", "untracked.ts"].sort());
    expect(resolveSelectedPaths(root, { flags: diff, paths: [] }).sort()).toEqual(
      ["game.ts", "staged.ts", "untracked.ts"].sort(),
    );
    git(root, "add", ".");
    commit(root);
    // A clean tree falls back to the HEAD commit, never older history.
    expect(resolveSelectedPaths(root, { flags: diff, paths: [] }).sort()).toEqual(
      ["game.ts", "staged.ts", "untracked.ts"].sort(),
    );
    const shallow = fixture();
    git(root, "clone", "--quiet", "--depth=1", pathToFileURL(root).href, shallow);
    expect(git(shallow, "rev-parse", "--is-shallow-repository")).toBe("true");
    // Without parent history, the HEAD fallback conservatively selects its entire tree.
    expect(resolveSelectedPaths(shallow, { flags: diff, paths: [] }).sort()).toEqual(
      ["game.ts", "history.ts", "staged.ts", "untracked.ts"].sort(),
    );
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
      const {expandRepositoryPaths} = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "scripts/lib/repository-paths.mjs")).href)});
      const root = ${JSON.stringify(root)};
      console.log(JSON.stringify({selected: expandRepositoryPaths(root, ['.'])}));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ selected: ["alive.ts", "game.ts"] });
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
    expect(parseAssetArgs([])).toMatchObject({ check: false, mode: "--prepare" });
    expect(parseAssetArgs(["--check"])).toMatchObject({ check: true, mode: "--prepare" });
    expect(parseAssetArgs(["--optimize", "--check"])).toMatchObject({ check: true, mode: "--optimize" });
    expect(parseAssetArgs(["--sync", "--check"])).toMatchObject({ check: true, mode: "--sync" });
    expect(parseAssetArgs(["--check", "--outputs-only"])).toMatchObject({ check: true, outputsOnly: true });
    for (const args of [
      ["--outputs-only"],
      ["--outputs-only", "--check", "--sync"],
      ["--outputs-only", "--check", "--optimize"],
    ]) {
      expect(() => parseAssetArgs(args)).toThrow("requires the full --check mode");
    }
    expect(() => parseAssetArgs(["--bogus"])).toThrow("Unknown argument");
    expect(() => parseAssetArgs(["--prepare", "--optimize"])).toThrow("Conflicting asset modes");
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
    for (const args of [["prepare"], ["--prepare", "--optimize"]]) {
      const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/assets.mjs"), ...args], {
        encoding: "utf8",
        env: { ...process.env, ALCHEMY_SKIP_ASSETS: "1" },
      });
      expect(result.status, result.stderr).toBe(2);
    }
  });

  it("rejects unsupported optimizer arguments before preparing assets", () => {
    const root = fixture();
    fs.cpSync(path.join(ROOT, "scripts"), path.join(root, "scripts"), { recursive: true });
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
    for (const script of ["optimize-assets.mjs", "optimize-music.mjs", "optimize-sounds.mjs"]) {
      for (const arg of ["--chek", "unexpected"]) {
        const result = spawnSync(process.execPath, [path.join(root, "scripts", script), arg], {
          cwd: root,
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(2);
        expect(result.stderr).toMatch(/Unknown option|Unexpected optimization arguments/);
      }
    }
    expect(fs.existsSync(path.join(root, "public"))).toBe(false);
    expect(fs.existsSync(path.join(root, "src"))).toBe(false);
  });

  it("keeps direct optimizer checks read-only when outputs are missing, current or stale", () => {
    const root = fixture();
    fs.cpSync(path.join(ROOT, "scripts"), path.join(root, "scripts"), { recursive: true });
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
    const source = path.join(root, "Raw Assets/Music/theme.ogg");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "authored music");
    fs.writeFileSync(
      path.join(root, "scripts/assets/music-assets.mjs"),
      `export const musicAssets = [{source: "Music/theme.ogg", target: "theme.ogg"}]; export async function validateMusicRegistry(files) { return files; }`,
    );
    const run = (script: string, ...args: string[]) =>
      spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ASSET_LIBRARY_ROOT: path.join(root, "Raw Assets") },
      });

    const stale = run("optimize-music.mjs", "--check");
    expect(stale.status, stale.stderr).toBe(1);
    expect(fs.existsSync(path.join(root, "public"))).toBe(false);

    expect(run("optimize-music.mjs").status).toBe(0);
    const output = path.join(root, "public/Music/theme.ogg");
    const manifest = path.join(root, "public/Music/.asset-hashes.json");
    const before = [output, manifest].map((file) => fs.readFileSync(file));
    expect(run("optimize-music.mjs", "--check").status).toBe(0);
    fs.writeFileSync(source, "changed music");
    expect(run("optimize-music.mjs", "--check").status).toBe(1);
    expect([output, manifest].map((file) => fs.readFileSync(file))).toEqual(before);
  });

  it("generates icons from the selected library master and records outputs that verify without that library", async () => {
    const root = fixture();
    fs.cpSync(path.join(ROOT, "scripts"), path.join(root, "scripts"), { recursive: true });
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
    const registry = path.join(root, "scripts/assets/icon-assets.mjs");
    fs.writeFileSync(
      registry,
      fs
        .readFileSync(registry, "utf8")
        .replace(/export const iconSource = "[^"]+";/u, 'export const iconSource = "chosen/icon.png";'),
    );
    const library = path.join(root, "external library");
    fs.mkdirSync(path.join(library, "chosen"), { recursive: true });
    await sharp({ create: { width: 32, height: 32, channels: 4, background: "red" } })
      .png()
      .toFile(path.join(library, "chosen/icon.png"));
    const generated = spawnSync(process.execPath, [path.join(root, "scripts/generate-icons.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ASSET_LIBRARY_ROOT: library },
    });
    expect(generated.status, generated.stderr).toBe(0);
    const receipt = path.join(root, "desktop/icons/.asset-hashes.json");
    const before = fs.readFileSync(receipt);
    fs.renameSync(path.join(library, "chosen/icon.png"), path.join(library, "renamed.png"));
    const recovered = spawnSync(process.execPath, [path.join(root, "scripts/generate-icons.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ASSET_LIBRARY_ROOT: library },
    });
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(fs.readFileSync(receipt)).toEqual(before);
    fs.rmSync(library, { recursive: true });
    const checked = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import { checkIconAssets } from './scripts/assets/icon-assets.mjs'; await checkIconAssets(process.cwd(), { outputsOnly: true });",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, ASSET_LIBRARY_ROOT: library } },
    );
    expect(checked.status, checked.stderr).toBe(0);
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
  it.each(["missing", "expired", "future-dated"])("never launches tests to replace a %s reused report", (state) => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        scripts: { "test:e2e:timings": "node -e \"require('node:fs').writeFileSync('tests-started', '')\"" },
      }),
    );
    if (state !== "missing") {
      fs.mkdirSync(path.join(root, "reports"));
      const report = path.join(root, "reports/e2e-results.json");
      fs.writeFileSync(report, JSON.stringify({ suites: [] }));
      const time = new Date(Date.now() + (state === "expired" ? -2 : 2) * 60 * 60 * 1000);
      fs.utimesSync(report, time, time);
    }
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/analyze-e2e.mjs"), "--reuse-timings"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("no tests were executed");
    expect(fs.existsSync(path.join(root, "tests-started"))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, "reports/current-run.json"), "utf8"))).toMatchObject({
      status: "failed",
      command: "npm run test:e2e:audit -- --reuse-timings",
    });
  });

  it.each([
    { name: "corrupt JSON", report: "{broken", failed: true },
    { name: "unexpected test", report: JSON.stringify({ suites: [], stats: { unexpected: 1 } }), failed: true },
    {
      name: "missing test outcome",
      report: JSON.stringify({ suites: [{ specs: [{ title: "unfinished test", tests: [{}] }] }] }),
      failed: true,
    },
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
      commandExposures: Array<{ key: string; command: string }>;
    };
    expect(record.status).toBe(failed ? "failed" : "passed");
    expect(record.commandExposures).toEqual([
      expect.objectContaining({ key: "e2e-report-analysis", command: "npm run test:e2e:audit -- --reuse-timings" }),
    ]);
  });
});
