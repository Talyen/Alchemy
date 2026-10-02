import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import { commandInvocation, resolveViteBin } from "../../scripts/lib/command-invocation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const temporary: string[] = [];
function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-cli-regressions-")));
  temporary.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

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

it.each([
  ["tsc", "typescript/bin/tsc"],
  ["knip", "knip/bin/knip.js"],
  ["concurrently", "concurrently/dist/bin/concurrently.js"],
])("launches %s with Node rather than a platform shell shim", (tool, relative) => {
  const literal = ["--version", "space & literal | argument"];
  const expected = [process.execPath, [path.join(ROOT, "node_modules", relative), ...literal]];
  expect(commandInvocation(tool, literal)).toEqual(expected);
  expect(commandInvocation("npx", [tool, ...literal])).toEqual(expected);
  expect(fs.existsSync(path.join(ROOT, "node_modules", relative))).toBe(true);
});

it.each([
  ["run-local-tests.mjs", []],
  ["run-ship-unit.mjs", ["--live"]],
  ["build-verified.mjs", ["--help", "--live"]],
  ["run-prettier.mjs", ["--write"]],
  ["play-demo.mjs", []],
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
    `const original = cp.spawnSync;
       cp.spawnSync = (command, args, options) => {
         if (args[0] !== 'scripts/run-playthrough-worker.mjs') return original(command, args, options);
         if (${JSON.stringify(missing)} !== 'output' || args[2].endsWith('discovery.json'))
           fs.writeFileSync(args[2], JSON.stringify({status: 'completed', telemetry: {battleSnapshots: [{stage: 'start', step: 1}]}}));
         return {status: 0, stderr: ''};
       };`,
  );
  expect(result.status, result.stdout).toBe(1);
  expect(result.stderr).toContain("ENOENT");
  expect(fs.existsSync(path.join(directory, "campaign-early.case.json"))).toBe(false);
});
