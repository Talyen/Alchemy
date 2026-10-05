import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { afterEach, expect, it } from "vitest";
import { parsePruneArgs, pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";
import { registerArtifactSession, withArtifactGuard } from "../../scripts/lib/artifact-guard.mjs";

const DAY = 86_400_000;
const now = Date.now();
const roots: string[] = [];
const releases: Array<() => void> = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const done = once(child, "exit");
      child.kill("SIGKILL");
      await done;
    }
  }
  for (const root of roots.splice(0)) {
    await withArtifactGuard(root, ({ directory }) => fs.rmSync(directory, { recursive: true, force: true }));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-expiry-"));
  roots.push(rootDir);
  const write = (name: string, age = 2 * DAY, text = "evidence") => {
    const file = path.join(rootDir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    fs.utimesSync(file, new Date(now - age), new Date(now - age));
    return file;
  };
  return { rootDir, write };
}
function ageDirectories(root: string) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) ageDirectories(path.join(root, entry.name));
  }
  fs.utimesSync(root, new Date(now - 2 * DAY), new Date(now - 2 * DAY));
}

it("expires whole runs by newest activity and preserves exact-boundary and fresh siblings", async () => {
  const { rootDir, write } = fixture();
  write("reports/runs/old/log.txt");
  write("reports/runs/old/run.json");
  write("reports/runs/fresh/old.log");
  write("reports/runs/fresh/new.log", 0);
  write("reports/bundle/old.json");
  write("reports/bundle/new.html", 0);
  write("reports/boundary.log", DAY);
  ageDirectories(rootDir);
  expect(parsePruneArgs([])).toEqual({ days: 1, dryRun: false });
  const preview = await pruneTransientArtifacts({ rootDir, now, dryRun: true });
  expect(preview.removed.map((e) => e.path)).toEqual([path.join("reports/runs/old")]);
  expect(fs.existsSync(path.join(rootDir, "reports/runs/old/log.txt"))).toBe(true);
  const result = await pruneTransientArtifacts({ rootDir, now });
  expect(result).toEqual(preview);
  expect(fs.existsSync(path.join(rootDir, "reports/runs/old"))).toBe(false);
  expect(fs.readFileSync(path.join(rootDir, "reports/runs/fresh/old.log"), "utf8")).toBe("evidence");
  expect(fs.existsSync(path.join(rootDir, "reports/bundle/old.json"))).toBe(true);
});

it("removes both pointers when their run expires, including in a consistent preview", async () => {
  const { rootDir, write } = fixture();
  write("reports/runs/expired/run.json");
  write("reports/current-run.json", 0, JSON.stringify({ runId: "expired" }));
  write("reports/current-run.md", 0);
  ageDirectories(rootDir);
  const preview = await pruneTransientArtifacts({ rootDir, now, dryRun: true });
  expect(preview.removed).toHaveLength(3);
  expect(fs.existsSync(path.join(rootDir, "reports/current-run.md"))).toBe(true);
  expect(await pruneTransientArtifacts({ rootDir, now })).toEqual(preview);
  expect(fs.existsSync(path.join(rootDir, "reports/current-run.json"))).toBe(false);
});

it("preserves pointers to fresh runs and safely discards broken pointers without escaping roots", async () => {
  const { rootDir, write } = fixture();
  write("reports/runs/fresh/run.json", 0);
  write("reports/current-run.json", 2 * DAY, JSON.stringify({ runId: "fresh" }));
  write("reports/current-run.md");
  ageDirectories(rootDir);
  expect((await pruneTransientArtifacts({ rootDir, now })).removed).toEqual([]);
  write("reports/current-run.json", 0, JSON.stringify({ runId: "missing" }));
  expect((await pruneTransientArtifacts({ rootDir, now })).removed).toHaveLength(2);
  write("reports/current-run.json", 0, JSON.stringify({ runId: "../../source" }));
  expect((await pruneTransientArtifacts({ rootDir, now })).removed).toEqual([]);
});

it.each([true, false])("does not traverse symlinked roots or nested links (dryRun=%s)", async (dryRun) => {
  const { rootDir } = fixture();
  const external = fixture();
  external.write("current-run.json", 2 * DAY, JSON.stringify({ runId: "missing" }));
  external.write("current-run.md");
  external.write("source.txt");
  fs.symlinkSync(external.rootDir, path.join(rootDir, "reports"), "dir");
  expect((await pruneTransientArtifacts({ rootDir, now, dryRun })).removed).toEqual([]);
  expect(fs.existsSync(path.join(external.rootDir, "current-run.json"))).toBe(true);
  fs.unlinkSync(path.join(rootDir, "reports"));
  fs.mkdirSync(path.join(rootDir, "reports"));
  const link = path.join(rootDir, "reports/external");
  fs.symlinkSync(external.rootDir, link, "dir");
  fs.lutimesSync(link, new Date(now - 2 * DAY), new Date(now - 2 * DAY));
  await pruneTransientArtifacts({ rootDir, now, dryRun });
  expect(fs.existsSync(path.join(external.rootDir, "source.txt"))).toBe(true);
  expect(fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() ?? false).toBe(dryRun);
});

it("serializes concurrent registrations and protects silent output until every owner releases", async () => {
  const { rootDir, write } = fixture();
  const old = write("reports/old.log");
  const owners = await Promise.all([registerArtifactSession(rootDir), registerArtifactSession(rootDir)]);
  releases.push(...owners);
  expect((await pruneTransientArtifacts({ rootDir, now })).skippedActive).toBe(true);
  owners[0]!();
  expect((await pruneTransientArtifacts({ rootDir, now })).skippedActive).toBe(true);
  owners[1]!();
  expect((await pruneTransientArtifacts({ rootDir, now })).skippedActive).toBe(false);
  expect(fs.existsSync(old)).toBe(false);
});

it("recovers a killed owner's guard only after exit, without mutating it during dry runs", async () => {
  const { rootDir, write } = fixture();
  const old = write("reports/old.log");
  const moduleUrl = new URL("../../scripts/lib/artifact-guard.mjs", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { registerArtifactSession } from ${JSON.stringify(moduleUrl)}; await registerArtifactSession(${JSON.stringify(rootDir)}); console.log('ready'); setInterval(() => {}, 1000);`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(child);
  await once(child.stdout!, "data");
  expect((await pruneTransientArtifacts({ rootDir, now })).skippedActive).toBe(true);
  const guardDir = await withArtifactGuard(rootDir, ({ directory }) => directory);
  const records = fs.readdirSync(guardDir);
  const done = once(child, "exit");
  child.kill("SIGKILL");
  await done;
  expect((await pruneTransientArtifacts({ rootDir, now, dryRun: true })).skippedActive).toBe(false);
  expect(fs.readdirSync(guardDir)).toEqual(records);
  expect(fs.existsSync(old)).toBe(true);
  await pruneTransientArtifacts({ rootDir, now });
  expect(fs.readdirSync(guardDir)).toEqual([]);
  expect(fs.existsSync(old)).toBe(false);
});

it("preserves output when ownership is malformed rather than guessing that it is abandoned", async () => {
  const { rootDir, write } = fixture();
  const old = write("reports/old.log");
  await withArtifactGuard(rootDir, ({ directory }) => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "unknown-owner"), "");
  });
  expect((await pruneTransientArtifacts({ rootDir, now })).skippedActive).toBe(true);
  expect(fs.existsSync(old)).toBe(true);
});

it("lets a consumer read an old snapshot before pruning at normal idle exit", async () => {
  const { rootDir, write } = fixture();
  const old = write("reports/old.log");
  const guardUrl = new URL("../../scripts/lib/artifact-guard.mjs", import.meta.url).href;
  const pruneUrl = new URL("../../scripts/prune-transient-artifacts.mjs", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import fs from 'node:fs';
    import { registerArtifactSession } from ${JSON.stringify(guardUrl)};
    import { pruneExpiredArtifacts } from ${JSON.stringify(pruneUrl)};
    await registerArtifactSession(${JSON.stringify(rootDir)}, () => pruneExpiredArtifacts({ rootDir: ${JSON.stringify(rootDir)}, now: ${now} }));
    console.log(fs.readFileSync(${JSON.stringify(old)}, 'utf8'));
  `,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(child);
  let output = "";
  child.stdout!.on("data", (chunk) => {
    output += chunk.toString();
  });
  const [code] = await once(child, "exit");
  expect(code).toBe(0);
  expect(output).toContain("evidence");
  expect(fs.existsSync(old)).toBe(false);
});
