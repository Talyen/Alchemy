#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chooseCheckpointStep, selectCase } from "../performance/case-selection.mjs";

const [outputDir, scenario, seedText = "42"] = process.argv.slice(2);
if (!outputDir || !scenario) throw new Error("Usage: prepare-performance-cases <output-dir> <scenario> [seed]");
const selected = selectCase(scenario, Number(seedText));
const workDir = path.join(outputDir, "case-generation", scenario);
fs.mkdirSync(workDir, { recursive: true });
const config = {
  seed: selected.seed,
  hero: selected.hero,
  mode: selected.mode,
  difficulty: selected.difficulty,
  runs:
    scenario === "trinket-journey"
      ? 3
      : ["campaign-developed", "meta-journey", "seeded-discovery"].includes(scenario)
        ? 2
        : 1,
  horizon: 4,
  maxSteps: scenario === "trinket-journey" ? 3500 : 2500,
  maxTurns: 100,
  combatPolicy: "greedy-effective-damage",
  policy: selected.policy,
};
const fixture = ["meta-journey", "trinket-journey"].includes(scenario)
  ? "economy-v1"
  : selected.hero !== "knight" || selected.mode !== "campaign"
    ? "unlocked-v1"
    : null;

function runWorker(label, checkpointAt) {
  const input = path.join(workDir, `${label}.input.json`);
  const output = path.join(workDir, `${label}.json`);
  const journal = path.join(workDir, `${label}.journal.jsonl`);
  fs.writeFileSync(
    input,
    JSON.stringify({ config, ...(fixture ? { fixture } : {}), ...(checkpointAt ? { checkpointAt } : {}) }),
  );
  fs.writeFileSync(journal, "");
  const child = spawnSync(process.execPath, ["scripts/run-playthrough-worker.mjs", input, output, journal], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (child.status !== 0)
    throw new Error(`Playthrough ${label} failed: ${child.error?.message ?? child.stderr.slice(-3000)}`);
  const result = JSON.parse(fs.readFileSync(output, "utf8"));
  if (result.status !== "completed") throw new Error(`Playthrough ${label} incomplete: ${result.error ?? "unknown"}`);
  return { output, result };
}

const discovery = runWorker("discovery");
const step = chooseCheckpointStep(selected, discovery.result);
if (!Number.isSafeInteger(step) || step < 1) {
  throw new Error(`No reachable ${selected.checkpoint} checkpoint for ${scenario} seed ${selected.seed}`);
}
const checkpoint = runWorker("checkpoint", step);
const saved = JSON.parse(fs.readFileSync(`${checkpoint.output}.checkpoint`, "utf8"));
const initialSave = JSON.parse(saved.bytes);
if (!initialSave || typeof initialSave !== "object") throw new Error("Checkpoint has no save");
const activeRun = initialSave.activeRun;
if (!activeRun && selected.checkpoint !== "late-run") throw new Error("Checkpoint has no active run");
const coverage = {
  cards: [...new Set((activeRun?.runDeck ?? []).map((card) => card.id))].sort(),
  enemy: activeRun?.activeCombat?.battleState?.currentEnemy?.id ?? null,
  traits: (activeRun?.activeCombat?.battleState?.currentEnemy?.traits ?? []).map((trait) => trait.id ?? trait),
  companions: Object.keys(initialSave.bondedCompanions ?? {}).filter((id) => initialSave.bondedCompanions[id] > 0),
  trinkets: Object.values(initialSave.equippedTrinkets ?? {}).filter(Boolean),
  boons: activeRun?.runBoons ?? [],
  gear: Object.values(initialSave.gearLoadouts ?? {})
    .flatMap((loadout) => Object.values(loadout ?? {}))
    .filter(Boolean)
    .map(
      (instanceId) =>
        Object.values(initialSave.gearInventories ?? {})
          .flat()
          .find((item) => item.instanceId === instanceId)?.definitionId ?? instanceId,
    ),
  uniques: initialSave.discoveredUniqueIds ?? [],
  talents: Object.values(initialSave.unlockedTalents ?? {}).flatMap((ids) => (Array.isArray(ids) ? ids : [])),
};
if (scenario === "campaign-developed" && (coverage.talents.length === 0 || coverage.gear.length === 0)) {
  throw new Error("Developed Campaign checkpoint lacks earned talents or gear");
}
if (
  scenario === "meta-journey" &&
  (coverage.talents.length === 0 ||
    coverage.gear.length === 0 ||
    coverage.companions.length === 0 ||
    coverage.boons.length === 0)
) {
  throw new Error("Developed account checkpoint lacks talents, gear, companion bonds, or boons");
}
if (scenario === "trinket-journey" && (coverage.trinkets.length === 0 || coverage.uniques.length === 0)) {
  throw new Error("Trinket checkpoint lacks an equipped trinket or discovered Unique item");
}
if (
  scenario === "trinket-journey" &&
  (activeRun?.activeCombat?.battleState?.trinketEffects?.companionDamageBonus ?? 0) <= 0
) {
  throw new Error("Trinket checkpoint lacks the active Companion's Collar battle effect");
}
const saveHash = createHash("sha256").update(JSON.stringify(initialSave)).digest("hex");
const sourceHash = createHash("sha256");
const sourcePaths = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "src",
    "performance",
    "scripts",
    "tests/pages",
    "tests/e2e",
    "package.json",
    "package-lock.json",
  ],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((file) => /\.(?:tsx?|m?js|json)$/.test(file) && fs.existsSync(file));
for (const file of [...new Set(sourcePaths)].sort()) sourceHash.update(file).update(fs.readFileSync(file));
const manifest = {
  version: 1,
  ...selected,
  checkpointStep: step,
  saveHash,
  codeIdentity: {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceHash: sourceHash.digest("hex"),
  },
  coverage,
  initialSave,
};
const target = path.join(outputDir, `${scenario}.case.json`);
fs.writeFileSync(target, JSON.stringify(manifest, null, 2));
console.log(`Prepared ${scenario}: ${selected.hero}/${selected.mode} seed=${selected.seed} step=${step} → ${target}`);
