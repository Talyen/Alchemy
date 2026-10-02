import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import { parsePerformanceArgs } from "../../scripts/run-performance.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const temporary: string[] = [];
function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-script-review-")));
  temporary.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

// Probe CLI orchestration in a separate process without starting simulation,
// downloads, builds, or browser tests.
function probe(script: string, args: string[], cwd: string, interception: string) {
  const filename = path.join(ROOT, "scripts", script);
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import cp from 'node:child_process';
       import fs from 'node:fs';
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

it.each(["run-playthrough.mjs", "prepare-performance-cases.mjs"])(
  "%s resolves its worker and input files independently of the caller directory",
  (script) => {
    const directory = fixture();
    const args = script === "run-playthrough.mjs" ? ["--out", "output", "--seeds", "42"] : ["output", "campaign-early"];
    const result = probe(
      script,
      args,
      directory,
      `const original = cp.spawnSync;
       cp.spawnSync = (command, args, options) => {
         if (args[0] !== 'scripts/run-playthrough-worker.mjs') return original(command, args, options);
         console.log(JSON.stringify({cwd: options.cwd, input: args[1], request: JSON.parse(fs.readFileSync(args[1], 'utf8'))}));
         throw new Error('worker intercepted');
       };`,
    );
    expect(result.stderr).toContain("worker intercepted");
    const worker = JSON.parse(result.stdout.trim());
    expect(worker.cwd).toBe(ROOT);
    expect(worker.input.startsWith(path.join(directory, "output") + path.sep)).toBe(true);
    expect(worker.request.config.seed).toBe(42);
    if (script === "run-playthrough.mjs") {
      const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
      expect(worker.request.codeIdentity.head).toBe(head);
    }
  },
);

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
  ]) {
    const result = probe(
      "run-playthrough.mjs",
      ["--out", output, ...args],
      directory,
      `const original = cp.spawnSync;
       cp.spawnSync = (command, args, options) => {
         if (args[0] === 'scripts/run-playthrough-worker.mjs') throw new Error('unexpected worker launch');
         return original(command, args, options);
       };`,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Seed must be|--timeout must be/);
    expect(fs.readdirSync(output)).toEqual(["career-0-42.json"]);
    expect(fs.readFileSync(evidence, "utf8")).toBe("existing replay evidence");
  }
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
