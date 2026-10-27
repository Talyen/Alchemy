import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { withReportServer } from "./lib/vite-report-server.mjs";
import { readBalanceShards } from "./lib/balance-shards.mjs";

const root = resolve(import.meta.dirname, "..");
const checkpoint = resolve(root, process.env.ALCHEMY_BALANCE_CHECKPOINT ?? "reports/balance-batches");
const rawBudget = process.env.ALCHEMY_BALANCE_BATCH_GROUPS ?? "10";
const budget = Number(rawBudget);
const rawTime = process.env.ALCHEMY_BALANCE_BATCH_MS;
const timeBudget = rawTime === undefined ? Infinity : Number(rawTime);
if (rawTime !== undefined && (!/^[1-9]\d*$/.test(rawTime) || !Number.isSafeInteger(timeBudget)))
  throw new Error("ALCHEMY_BALANCE_BATCH_MS must be a positive integer");
const rawShardCount = process.env.ALCHEMY_BALANCE_SHARD_COUNT;
const rawShardIndex = process.env.ALCHEMY_BALANCE_SHARD_INDEX;
if (
  (rawShardCount === undefined) !== (rawShardIndex === undefined) ||
  (rawShardCount !== undefined && (!/^[1-9]\d*$/.test(rawShardCount) || !/^\d+$/.test(rawShardIndex)))
)
  throw new Error("Both valid ALCHEMY_BALANCE_SHARD_COUNT and ALCHEMY_BALANCE_SHARD_INDEX are required");
const shardCount = rawShardCount === undefined ? 1 : Number(rawShardCount);
const shardIndex = rawShardIndex === undefined ? 0 : Number(rawShardIndex);
if (!Number.isSafeInteger(shardCount) || !Number.isSafeInteger(shardIndex) || shardIndex >= shardCount)
  throw new Error("Balance shard index must be less than shard count");
const mergeDir = process.env.ALCHEMY_BALANCE_MERGE_DIR;
if (mergeDir && rawShardCount !== undefined) throw new Error("Cannot merge and run a shard at the same time");
const started = performance.now();
const deadline = started + timeBudget;
const timing = { setupMs: 0, sourceHashMs: 0, simulationMs: 0, checkpointMs: 0, reportMs: 0 };
function timed(key, fn) {
  const start = performance.now();
  try {
    return fn();
  } finally {
    timing[key] += performance.now() - start;
  }
}
process.once("exit", () =>
  console.info(
    `[balance timings] ${JSON.stringify(
      Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, Math.round(value)])),
    )}`,
  ),
);
if (!/^[1-9]\d*$/.test(rawBudget) || !Number.isSafeInteger(budget))
  throw new Error("ALCHEMY_BALANCE_BATCH_GROUPS must be a positive integer");

function sourceHash() {
  return timed("sourceHashMs", () => {
    const names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
      .toString()
      .split("\0")
      .filter(
        (name) => /^(src|scripts)\//.test(name) || /^(package-lock\.json|package\.json|game-edition\.mjs)$/.test(name),
      );
    const hash = createHash("sha256").update(`edition:${process.env.ALCHEMY_EDITION ?? "default"}`);
    for (const name of [...new Set(names)].sort()) {
      const path = resolve(root, name);
      if (existsSync(path))
        hash
          .update(name)
          .update("\0")
          .update(createHash("sha256").update(readFileSync(path)).digest());
    }
    return hash.digest("hex");
  });
}

function writeAtomic(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value));
  renameSync(temp, path);
}

mkdirSync(checkpoint, { recursive: true });
const lockPath = resolve(checkpoint, ".lock");
let lock;
try {
  lock = openSync(lockPath, "wx");
} catch (error) {
  if (error.code === "EEXIST")
    throw new Error(`Checkpoint is locked: ${lockPath}. Verify its owner before recovery.`, { cause: error });
  throw error;
}
writeFileSync(lock, JSON.stringify({ pid: process.pid }));
function releaseLock() {
  if (lock === undefined) return;
  const owned = fstatSync(lock);
  closeSync(lock);
  lock = undefined;
  try {
    const current = statSync(lockPath);
    if (current.dev === owned.dev && current.ino === owned.ino) unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
process.once("exit", releaseLock);
process.once("SIGINT", () => process.exit(130));
process.once("SIGTERM", () => process.exit(143));

const initialSourceHash = sourceHash();
await withReportServer(async (server) => {
  const api = await server.ssrLoadModule("/src/lib/balance/index.ts");
  const { runPairedGroupResumable, summarizePairedGroups } = await server.ssrLoadModule(
    "/src/lib/balance/report-sweep-runner.ts",
  );
  const { summarizeCoreRates } = await server.ssrLoadModule("/src/lib/balance/core-report-summary.ts");
  timing.setupMs = performance.now() - started - timing.sourceHashMs;
  const options = api.parseBalanceReportOptions(process.env);
  if (sourceHash() !== initialSourceHash) throw new Error("Source changed while loading the simulator");
  const identity = { version: 1, sourceHash: initialSourceHash, options };
  const manifest = resolve(checkpoint, "manifest.json");
  if (existsSync(manifest)) {
    if (JSON.stringify(JSON.parse(readFileSync(manifest, "utf8"))) !== JSON.stringify(identity))
      throw new Error("Checkpoint source or options differ; choose a new ALCHEMY_BALANCE_CHECKPOINT directory");
  } else writeAtomic(manifest, identity);

  const phases = [
    ["core", () => api.coreScenarios(options), (run) => api.compactCoreRow(run())],
    ["boons", () => api.trinketGroups(options), (group, runGroup) => runGroup(group)],
    ["cardsIsolatedSkeleton", () => api.isolatedCardGroups(options, "skeleton"), (group, runGroup) => runGroup(group)],
    ["cardsIsolatedElite", () => api.isolatedCardGroups(options, "mimic"), (group, runGroup) => runGroup(group)],
    ["cardsInClass", () => api.inClassCardGroups(options), (group, runGroup) => runGroup(group)],
    ["talents", () => api.talentGroups(options), (group, runGroup) => runGroup(group)],
    ["companions", () => api.companionGroups(options), (group, runGroup) => runGroup(group)],
    ["gear", () => api.gearGroups(options), (group, runGroup) => runGroup(group)],
    ["affixes", () => api.affixGroups(options), (group, runGroup) => runGroup(group)],
  ];
  const sourceCommit =
    mergeDir || rawShardCount !== undefined
      ? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
      : undefined;
  if (mergeDir) {
    const expected = phases.map(([name, groups]) => [name, [...groups()].length]);
    const groups = readBalanceShards(resolve(root, mergeDir), identity, expected, sourceCommit);
    for (const { name, filename, value } of groups) {
      mkdirSync(resolve(checkpoint, name), { recursive: true });
      const destination = resolve(checkpoint, name, filename);
      if (existsSync(destination)) {
        if (JSON.stringify(JSON.parse(readFileSync(destination, "utf8"))) !== JSON.stringify(value))
          throw new Error(`Merged group differs from shard: ${destination}`);
      } else writeAtomic(destination, value);
    }
  }
  if (rawShardCount !== undefined) {
    const shardPath = resolve(checkpoint, "shard.json");
    const shard = { index: shardIndex, count: shardCount, commit: sourceCommit };
    if (existsSync(shardPath) && JSON.stringify(JSON.parse(readFileSync(shardPath, "utf8"))) !== JSON.stringify(shard))
      throw new Error("Checkpoint belongs to a different shard");
    if (!existsSync(shardPath)) writeAtomic(shardPath, shard);
  }
  let completed = 0;
  let ordinal = 0;
  const paths = {};
  for (const [name, groups, run] of phases) {
    const dir = resolve(checkpoint, name);
    mkdirSync(dir, { recursive: true });
    paths[name] = [];
    let index = 0;
    for (const group of groups()) {
      const path = resolve(dir, `${index++}.json`);
      paths[name].push(path);
      const belongs = ordinal++ % shardCount === shardIndex;
      if (!belongs) continue;
      if (existsSync(path)) {
        const orphanedParts = resolve(dir, `${index - 1}.parts.json`);
        if (existsSync(orphanedParts)) unlinkSync(orphanedParts);
        continue;
      }
      if (mergeDir) throw new Error(`Merged checkpoint is missing ${path}`);
      if (completed >= budget || performance.now() >= deadline) {
        console.info(
          `Saved ${completed} groups; resume with the same command and options. Next: ${name}/${index - 1}.`,
        );
        return;
      }
      const partsPath = resolve(dir, `${index - 1}.parts.json`);
      const parts = existsSync(partsPath) ? JSON.parse(readFileSync(partsPath, "utf8")) : {};
      let dirtyParts = 0;
      function flushParts() {
        if (!dirtyParts) return;
        if (sourceHash() !== identity.sourceHash)
          throw new Error("Source changed during the batch; partial results were not saved");
        timed("checkpointMs", () => writeAtomic(partsPath, parts));
        dirtyParts = 0;
      }
      const otherBefore = timing.sourceHashMs + timing.checkpointMs;
      const result = timed("simulationMs", () =>
        run(group, (paired) =>
          runPairedGroupResumable(options, paired, {
            read: (part, id) => {
              const saved = parts[part];
              if (saved && saved.id !== id) throw new Error(`Mismatched partial result: ${partsPath}/${part}`);
              return saved;
            },
            write: (part, entry) => {
              parts[part] = entry;
              if (++dirtyParts >= 16) flushParts();
            },
            shouldContinue: () => performance.now() < deadline,
          }),
        ),
      );
      timing.simulationMs -= timing.sourceHashMs + timing.checkpointMs - otherBefore;
      flushParts();
      if (result === undefined) {
        console.info(`Saved partial ${name}/${index - 1}; resume with the same command and options.`);
        return;
      }
      if (sourceHash() !== identity.sourceHash)
        throw new Error("Source changed during the batch; the current group was not saved");
      timed("checkpointMs", () => writeAtomic(path, result));
      if (existsSync(partsPath)) unlinkSync(partsPath);
      completed++;
      console.info(`Saved ${name}/${index - 1}`);
    }
  }
  if (rawShardCount !== undefined) {
    console.info(`Balance shard complete: ${shardIndex}/${shardCount}`);
    return;
  }
  const reportStart = performance.now();
  const read = (name) => paths[name].map((path) => JSON.parse(readFileSync(path, "utf8")));
  const coreChunks = read("core");
  const core = coreChunks.map((chunk) => chunk.row);
  const { anomalies } = api.collectAnomalies(core);
  const metrics = api.mergeCoreMetrics(coreChunks);
  const sweeps = Object.fromEntries(
    phases
      .slice(1)
      .map(([name]) => [
        name,
        summarizePairedGroups(read(name)).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
      ]),
  );
  const model = api.composeBalanceReport(options, summarizeCoreRates(core), sweeps, { anomalies, metrics });
  const findings = api.evaluateBalanceFindings(model, options);
  if (sourceHash() !== identity.sourceHash) throw new Error("Source changed before report generation");
  const reportDir = resolve(checkpoint, "report");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, "matrix.html"), api.renderBalanceReportHtml(model, options));
  writeFileSync(resolve(reportDir, "matrix.json"), api.renderBalanceReportJson(model, options));
  writeFileSync(resolve(reportDir, "balance-findings.html"), api.renderBalanceFindingsHtml(findings, model));
  writeFileSync(resolve(reportDir, "balance-findings.json"), api.renderBalanceFindingsJson(findings, model, options));
  timing.reportMs += performance.now() - reportStart;
  console.info(
    `Balance report complete: ${findings.findings.length}/${findings.totalBeforeCap} findings at ${reportDir}`,
  );
});
