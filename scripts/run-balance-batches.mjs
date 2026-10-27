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

const root = resolve(import.meta.dirname, "..");
const checkpoint = resolve(root, process.env.ALCHEMY_BALANCE_CHECKPOINT ?? "reports/balance-batches");
const budget = Number(process.env.ALCHEMY_BALANCE_BATCH_GROUPS ?? 10);
if (!Number.isSafeInteger(budget) || budget <= 0)
  throw new Error("ALCHEMY_BALANCE_BATCH_GROUPS must be a positive integer");

function sourceHash() {
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
  const { runPairedGroup, summarizePairedGroups } = await server.ssrLoadModule(
    "/src/lib/balance/report-sweep-runner.ts",
  );
  const { summarizeCoreRates } = await server.ssrLoadModule("/src/lib/balance/core-report-summary.ts");
  const options = api.parseBalanceReportOptions(process.env);
  if (sourceHash() !== initialSourceHash) throw new Error("Source changed while loading the simulator");
  const identity = { version: 1, sourceHash: initialSourceHash, options };
  const manifest = resolve(checkpoint, "manifest.json");
  if (existsSync(manifest)) {
    if (JSON.stringify(JSON.parse(readFileSync(manifest, "utf8"))) !== JSON.stringify(identity))
      throw new Error("Checkpoint source or options differ; choose a new ALCHEMY_BALANCE_CHECKPOINT directory");
  } else writeAtomic(manifest, identity);

  const phases = [
    ["core", () => api.coreScenarios(options), (run) => run()],
    ["boons", () => api.trinketGroups(options), (group) => runPairedGroup(options, group)],
    [
      "cardsIsolatedSkeleton",
      () => api.isolatedCardGroups(options, "skeleton"),
      (group) => runPairedGroup(options, group),
    ],
    ["cardsIsolatedElite", () => api.isolatedCardGroups(options, "mimic"), (group) => runPairedGroup(options, group)],
    ["cardsInClass", () => api.inClassCardGroups(options), (group) => runPairedGroup(options, group)],
    ["talents", () => api.talentGroups(options), (group) => runPairedGroup(options, group)],
    ["companions", () => api.companionGroups(options), (group) => runPairedGroup(options, group)],
    ["gear", () => api.gearGroups(options), (group) => runPairedGroup(options, group)],
    ["affixes", () => api.affixGroups(options), (group) => runPairedGroup(options, group)],
  ];
  let completed = 0;
  const paths = {};
  for (const [name, groups, run] of phases) {
    const dir = resolve(checkpoint, name);
    mkdirSync(dir, { recursive: true });
    paths[name] = [];
    let index = 0;
    for (const group of groups()) {
      const path = resolve(dir, `${index++}.json`);
      paths[name].push(path);
      if (existsSync(path)) continue;
      if (completed >= budget) {
        console.info(
          `Saved ${completed} groups; resume with the same command and options. Next: ${name}/${index - 1}.`,
        );
        return;
      }
      const result = run(group);
      if (sourceHash() !== identity.sourceHash)
        throw new Error("Source changed during the batch; the current group was not saved");
      writeAtomic(path, result);
      completed++;
      console.info(`Saved ${name}/${index - 1}`);
    }
  }
  const read = (name) => paths[name].map((path) => JSON.parse(readFileSync(path, "utf8")));
  const core = read("core");
  const { anomalies, metrics } = api.collectAnomalies(core);
  const model = {
    meta: {
      samplingMode: options.mode ?? "custom",
      policy: options.policy,
      loadoutMode: options.loadoutMode,
      iterations: options.iterations,
      pairedIterations: options.pairedIterations,
      cardDeckSamples: options.cardDeckSamples,
      deckSeeds: options.deckSeeds,
    },
    ...summarizeCoreRates(core),
    ...Object.fromEntries(
      phases
        .slice(1)
        .map(([name]) => [
          name,
          summarizePairedGroups(read(name)).sort((a, b) => a.deltas.late.delta - b.deltas.late.delta),
        ]),
    ),
    anomalies,
    anomalyMetrics: metrics,
  };
  const findings = api.evaluateBalanceFindings(model, options);
  if (sourceHash() !== identity.sourceHash) throw new Error("Source changed before report generation");
  const reportDir = resolve(checkpoint, "report");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, "matrix.html"), api.renderBalanceReportHtml(model, options));
  writeFileSync(resolve(reportDir, "matrix.json"), api.renderBalanceReportJson(model, options));
  writeFileSync(resolve(reportDir, "balance-findings.html"), api.renderBalanceFindingsHtml(findings, model));
  writeFileSync(resolve(reportDir, "balance-findings.json"), api.renderBalanceFindingsJson(findings, model, options));
  console.info(
    `Balance report complete: ${findings.findings.length}/${findings.totalBeforeCap} findings at ${reportDir}`,
  );
});
