import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveViteBin } from "../../scripts/lib/command-invocation.mjs";

import { parsePerformanceArgs } from "../../scripts/run-performance.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const temporary: string[] = [];
function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-cli-orchestration-")));
  temporary.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

// Probe CLI orchestration without starting simulations, downloads, builds, or browser tests.
function probe(script: string, args: string[], cwd: string, interception: string) {
  const filename = path.join(ROOT, "scripts", script);
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import cp from 'node:child_process';
       import fs from 'node:fs';
       import net from 'node:net';
       import { syncBuiltinESMExports } from 'node:module';
       ${interception}
       syncBuiltinESMExports();
       process.argv = ${JSON.stringify([process.execPath, filename, ...args])};
       try { await import(${JSON.stringify(pathToFileURL(filename).href)}); }
       catch (error) { console.error(error.message); process.exitCode = 1; }`,
    ],
    { cwd, encoding: "utf8", timeout: 10_000 },
  );
}

describe("CLI launch paths", () => {
  it.each([
    ["run-local-tests.mjs", []],
    ["run-ship-unit.mjs", ["--live"]],
    ["build-verified.mjs", ["--help", "--live"]],
    ["run-prettier.mjs", ["--write"]],
    ["play-demo.mjs", []],
    ["run-interactions.mjs", []],
  ] as const)("%s launches against the checkout from another directory", (script, args) => {
    // Isolate the lane too: this probe inspects launch options while the parent
    // unit runner holds the real lane. No nested test or build process starts.
    const result = probe(
      script,
      [...args],
      fixture(),
      `net.createServer = () => ({once() {}, listen(_options, ready) { ready(); }, address() { return {port: 0}; }, close(done) { done(); }});
       cp.spawn = cp.spawnSync = (_command, args, options) => {
         console.log('PROBE ' + JSON.stringify({cwd: options.cwd, args}));
         throw new Error('subprocess intercepted');
       };`,
    );
    expect(result.stderr).toContain("subprocess intercepted");
    const line = result.stdout.split("\n").find((line) => line.startsWith("PROBE "));
    expect(line).toBeDefined();
    const child = JSON.parse(line!.slice(6));
    expect(child.cwd).toBe(ROOT);
    if (script === "build-verified.mjs") expect(child.args[0]).toBe(resolveViteBin());
  });

  it("routes profiling browsers through the shared test lane", () => {
    const directory = fixture();
    const result = probe(
      "run-performance.mjs",
      ["--skip-build", "--scenario", "startup-first-use", "--live"],
      directory,
      `const originalExists = fs.existsSync;
       fs.existsSync = (file) => String(file) === ${JSON.stringify(path.join(ROOT, "dist/index.html"))} || originalExists(file);
       const originalMkdir = fs.mkdirSync;
       fs.mkdirSync = (file, options) => originalMkdir(String(file).replace(${JSON.stringify(path.join(ROOT, "reports/performance"))}, ${JSON.stringify(path.join(directory, "performance"))}), options);
       cp.spawn = cp.spawnSync = (_command, args, options) => {
         console.log('PROBE ' + JSON.stringify({cwd: options.cwd, args}));
         throw new Error('subprocess intercepted');
       };`,
    );
    expect(result.stderr).toContain("subprocess intercepted");
    const line = result.stdout.split("\n").find((line) => line.startsWith("PROBE "));
    expect(line).toBeDefined();
    const child = JSON.parse(line!.slice(6));
    expect(child.cwd).toBe(ROOT);
    expect(child.args.slice(0, 5)).toEqual([
      "scripts/run-compact.mjs",
      "playwright",
      "test",
      "--config",
      "playwright.performance.config.ts",
    ]);
  });

  it.each(["run-playthrough.mjs", "prepare-performance-cases.mjs"])(
    "%s resolves its worker and input files independently of the caller directory",
    (script) => {
      const directory = fixture();
      const args =
        script === "run-playthrough.mjs" ? ["--out", "output", "--seeds", "42"] : ["output", "campaign-early"];
      const result = probe(
        script,
        args,
        directory,
        `cp.spawn = (command, args, options) => {
           console.log(JSON.stringify({cwd: options.cwd, detached: options.detached, input: args[1], request: JSON.parse(fs.readFileSync(args[1], 'utf8'))}));
           throw new Error('worker intercepted');
         };`,
      );
      expect(result.stderr).toContain("worker intercepted");
      const worker = JSON.parse(result.stdout.trim());
      expect(worker.cwd).toBe(ROOT);
      expect(worker.detached).toBe(process.platform !== "win32");
      expect(worker.input.startsWith(path.join(directory, "output") + path.sep)).toBe(true);
      expect(worker.request.config.seed).toBe(42);
      if (script === "run-playthrough.mjs") {
        const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
        expect(worker.request.codeIdentity.head).toBe(head);
        expect(worker.request.config.brewing).toBe("on");
      }
    },
  );
});

describe("CLI validation before side effects", () => {
  it("honors --skip-build when the profiling renderer is missing", () => {
    const result = probe(
      "run-performance.mjs",
      ["--skip-build", "--scenario", "startup-first-use"],
      fixture(),
      `const originalExists = fs.existsSync;
       fs.existsSync = (file) => String(file) === ${JSON.stringify(path.join(ROOT, "dist/index.html"))} ? false : originalExists(file);
       cp.spawn = cp.spawnSync = () => { throw new Error('unexpected subprocess'); };`,
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--skip-build requires an existing renderer");
    expect(result.stderr).not.toContain("unexpected subprocess");
    expect(result.stdout).not.toContain("Building production renderer");
  });

  it.each([null, {}, { version: 2, scenario: "campaign-early" }, { version: 1, scenario: "unknown" }])(
    "rejects an invalid profiling replay before Electron setup or building: %j",
    (replay) => {
      const directory = fixture();
      fs.writeFileSync(path.join(directory, "replay.json"), JSON.stringify(replay));
      const result = probe(
        "run-performance.mjs",
        ["--replay", "replay.json", "--electron"],
        directory,
        `cp.spawn = cp.spawnSync = () => { throw new Error('unexpected subprocess'); };`,
      );
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Invalid replay bundle");
      expect(result.stderr).not.toContain("unexpected subprocess");
      expect(result.stdout).not.toContain("Ensuring Electron");
    },
  );

  it.each([{ args: ["--replay", "replay.json"] }, { args: ["--suite", "synthetic"] }, { args: ["--seed", "42"] }])(
    "rejects profiling options that comparison would silently ignore: $args",
    ({ args }) => {
      expect(() => parsePerformanceArgs(["--compare", "before", "after", ...args])).toThrow(
        "--compare cannot be combined with profiling options",
      );
    },
  );

  it("rejects unknown Git safety setup options even alongside --repo before modifying .envrc", () => {
    const directory = fixture();
    fs.mkdirSync(path.join(directory, "scripts"));
    fs.copyFileSync(
      path.join(ROOT, "scripts/setup-git-safety.mjs"),
      path.join(directory, "scripts/setup-git-safety.mjs"),
    );
    const envrc = path.join(directory, ".envrc");
    fs.writeFileSync(envrc, "existing configuration\n");
    const result = spawnSync(
      process.execPath,
      [path.join(directory, "scripts/setup-git-safety.mjs"), "--repo", "--bogus"],
      {
        cwd: directory,
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unknown option");
    expect(fs.readFileSync(envrc, "utf8")).toBe("existing configuration\n");
  });
});

describe("CLI evidence preservation", () => {
  it("validates the entire seed manifest and timeout before replacing playthrough evidence", () => {
    const directory = fixture();
    const output = path.join(directory, "output");
    fs.mkdirSync(output);
    const evidence = path.join(output, "career-0-42.json");
    fs.writeFileSync(evidence, "existing replay evidence");
    const manifest = path.join(directory, "manifest.json");
    fs.writeFileSync(manifest, JSON.stringify({ manifest: [{ seed: 42 }, { seed: "../../escaped" }] }));
    for (const args of [
      ["--manifest", manifest],
      ["--seeds", "42", "--timeout", "0"],
      ["--brewing", "unknown"],
      ["--comparison", "brewing"],
    ]) {
      const result = probe(
        "run-playthrough.mjs",
        ["--out", output, ...args],
        directory,
        `cp.spawn = () => { throw new Error('unexpected worker launch'); };`,
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Seed must be|--timeout must be|--brewing must be|Brewing comparison requires/);
      expect(fs.readdirSync(output)).toEqual(["career-0-42.json"]);
      expect(fs.readFileSync(evidence, "utf8")).toBe("existing replay evidence");
    }
  });

  it.each(["output", "checkpoint"])("refuses to publish a performance case from an old worker %s", (missing) => {
    const directory = fixture();
    const workDir = path.join(directory, "case-generation/campaign-early");
    fs.mkdirSync(workDir, { recursive: true });
    for (const name of ["discovery", "checkpoint"]) {
      fs.writeFileSync(
        path.join(workDir, `${name}.json`),
        JSON.stringify({ status: "completed", telemetry: { battleSnapshots: [{ stage: "start", step: 1 }] } }),
      );
      fs.writeFileSync(
        path.join(workDir, `${name}.json.checkpoint`),
        JSON.stringify({ bytes: JSON.stringify({ activeRun: { runDeck: [] } }) }),
      );
    }
    const result = probe(
      "prepare-performance-cases.mjs",
      [directory, "campaign-early"],
      directory,
      `const { EventEmitter } = await import('node:events');
         cp.spawn = (command, args, options) => {
           if (${JSON.stringify(missing)} !== 'output' || args[2].endsWith('discovery.json'))
             fs.writeFileSync(args[2], JSON.stringify({status: 'completed', telemetry: {battleSnapshots: [{stage: 'start', step: 1}]}}));
           const child = new EventEmitter();
           queueMicrotask(() => child.emit('close', 0));
           return child;
         };`,
    );
    expect(result.status, result.stdout).toBe(1);
    expect(result.stderr).toContain("ENOENT");
    expect(fs.existsSync(path.join(directory, "campaign-early.case.json"))).toBe(false);
  });
});
