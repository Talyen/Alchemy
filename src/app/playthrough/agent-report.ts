import type { CareerResult } from "./types";
import { careerCohort } from "./progress-telemetry";
import { characters } from "@/lib/game-data";

const MILESTONE_KINDS = [
  "talent",
  "building",
  "farm",
  "research",
  "bond",
  "equip",
  "equip-trinket",
  "craft",
  "salvage",
] as const;

type MilestoneKind = (typeof MILESTONE_KINDS)[number];
type MaybeNumber = number | null;

interface AgentCodeIdentity {
  head: string;
  sourceHash: string;
}

interface AgentEvidenceSelector {
  seeds?: number[];
  runs?: number[];
  rooms?: { min?: number; max?: number };
  enemies?: string[];
  outcomes?: string[];
}

type AgentFindingKind = "integrity" | "balance-signal" | "progression-signal" | "coverage-gap";
type AgentFindingPriority = "high" | "medium" | "low";
type AgentFindingConfidence = "high" | "moderate" | "directional" | "insufficient";

interface AgentFinding {
  id: string;
  cohort?: string;
  kind: AgentFindingKind;
  priority: AgentFindingPriority;
  confidence: AgentFindingConfidence;
  title: string;
  claim: string;
  evidence: Record<string, number | string>;
  interpretation: string;
  nextStep: string;
  selector?: AgentEvidenceSelector;
}

interface AgentDistribution {
  count: number;
  min: MaybeNumber;
  q25: MaybeNumber;
  median: MaybeNumber;
  mean: MaybeNumber;
  q75: MaybeNumber;
  max: MaybeNumber;
}

interface AgentMilestoneMetric {
  kind: MilestoneKind;
  reached: number;
  careers: number;
  rate: number;
  meanFirstRunAmongReached: MaybeNumber;
}

interface AgentBattleEnemyMetric {
  enemy: string;
  boss: boolean;
  encounters: number;
  victories: number;
  defeats: number;
  winRate: number;
  meanTurns: MaybeNumber;
}

interface AgentBattleMetrics {
  encounters: number;
  victories: number;
  defeats: number;
  winRate: number;
  meanTurns: MaybeNumber;
  bosses: {
    encounters: number;
    victories: number;
    defeats: number;
    winRate: number;
  };
  byEnemy: AgentBattleEnemyMetric[];
}

interface AgentRunProgression {
  careers: number;
  firstRunMeanRooms: MaybeNumber;
  finalRunMeanRooms: MaybeNumber;
  meanRoomDelta: MaybeNumber;
  improved: number;
  worsened: number;
  tied: number;
}

interface AgentRunOutcomeMetric {
  run: number;
  runs: number;
  victories: number;
  defeats: number;
  victoryRate: number;
  meanRooms: MaybeNumber;
}

interface AgentDeckCohesion {
  samples: number;
  heroKeywordShare: MaybeNumber;
  dominantKeywordShare: MaybeNumber;
  topKeywords: Array<{ keyword: string; count: number }>;
}

interface AgentCohortSummary {
  cohort: string;
  planned: number;
  completed: number;
  incomplete: number;
  runs: number;
  sampleSeeds: number[];
  outcomes: Record<string, number>;
  terminalRooms: AgentDistribution;
  terminalGold: AgentDistribution;
  survivalByRoom: Array<{ room: number; reached: number; defeats: number; denominator: number; rate: number }>;
  battles: AgentBattleMetrics;
  progression: AgentRunProgression;
  runOutcomes: AgentRunOutcomeMetric[];
  firstVictoryRun: Record<string, number>;
  neverWon: number;
  deckCohesion: AgentDeckCohesion;
  milestones: AgentMilestoneMetric[];
  coverageGaps: AgentMilestoneMetric[];
  findings: AgentFinding[];
}

export interface AgentPlaythroughSummary {
  version: 1;
  planned: number;
  completed: number;
  incomplete: number;
  codeIdentity?: AgentCodeIdentity;
  cohorts: AgentCohortSummary[];
  findings: AgentFinding[];
  recommendations: string[];
  artifacts: {
    reportJson: "playthrough.json";
    reportHtml: "playthrough.html";
    summaryJson: "agent-summary.json";
    summaryMarkdown: "agent-summary.md";
    careerBundles: "career-<index>-<seed>.json";
    journals: "career-<index>-<seed>.journal.jsonl";
  };
}

interface AgentSummaryOptions {
  planned?: number;
  codeIdentity?: AgentCodeIdentity;
  workerFailures?: string[];
}

type CompletedCareer = CareerResult & { status: "completed" };
type CareerRun = CompletedCareer["outcomes"][number] & { seed: number; run: number };
type Battle = CompletedCareer["telemetry"]["battles"][number] & { seed: number };

function round(value: number): number {
  return Number(value.toFixed(2));
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function mean(values: number[]): MaybeNumber {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function quantile(values: number[], probability: number): MaybeNumber {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? null;
  return round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower));
}

function distribution(values: number[]): AgentDistribution {
  return {
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    q25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    mean: mean(values),
    q75: quantile(values, 0.75),
    max: values.length ? Math.max(...values) : null,
  };
}

function selectorForDefeats(battles: Battle[], minRoom?: number): AgentEvidenceSelector {
  const defeats = battles.filter(
    (battle) => battle.outcome === "defeat" && (minRoom === undefined || battle.room >= minRoom),
  );
  const selector: AgentEvidenceSelector = {
    seeds: [...new Set(defeats.map((battle) => battle.seed))].slice(0, 12),
    outcomes: ["defeat"],
  };
  if (minRoom !== undefined) selector.rooms = { min: minRoom };
  return selector;
}

function buildMilestones(careers: CompletedCareer[]): AgentMilestoneMetric[] {
  return MILESTONE_KINDS.map((kind) => {
    const firstRuns = careers.flatMap((career) => {
      const reachedRuns = Object.entries(career.telemetry.milestones)
        .filter(([key]) => key.startsWith(`${kind}:`))
        .map(([, run]) => run + 1);
      return reachedRuns.length ? [Math.min(...reachedRuns)] : [];
    });
    return {
      kind,
      reached: firstRuns.length,
      careers: careers.length,
      rate: rate(firstRuns.length, careers.length),
      meanFirstRunAmongReached: mean(firstRuns),
    };
  });
}

function buildBattles(careers: CompletedCareer[]): { battles: Battle[]; metrics: AgentBattleMetrics } {
  const battles = careers.flatMap((career) =>
    career.telemetry.battles.map((battle) => ({ ...battle, seed: career.config.seed })),
  );
  const byEnemy = new Map<
    string,
    { enemy: string; boss: boolean; encounters: number; victories: number; defeats: number; turns: number }
  >();
  for (const battle of battles) {
    const current = byEnemy.get(battle.enemy) ?? {
      enemy: battle.enemy,
      boss: battle.boss,
      encounters: 0,
      victories: 0,
      defeats: 0,
      turns: 0,
    };
    current.encounters += 1;
    current.victories += battle.outcome === "victory" ? 1 : 0;
    current.defeats += battle.outcome === "defeat" ? 1 : 0;
    current.turns += battle.turns;
    byEnemy.set(battle.enemy, current);
  }
  const bosses = battles.filter((battle) => battle.boss);
  return {
    battles,
    metrics: {
      encounters: battles.length,
      victories: battles.filter((battle) => battle.outcome === "victory").length,
      defeats: battles.filter((battle) => battle.outcome === "defeat").length,
      winRate: rate(battles.filter((battle) => battle.outcome === "victory").length, battles.length),
      meanTurns: mean(battles.map((battle) => battle.turns)),
      bosses: {
        encounters: bosses.length,
        victories: bosses.filter((battle) => battle.outcome === "victory").length,
        defeats: bosses.filter((battle) => battle.outcome === "defeat").length,
        winRate: rate(bosses.filter((battle) => battle.outcome === "victory").length, bosses.length),
      },
      byEnemy: [...byEnemy.values()]
        .map(({ turns, ...enemy }) => ({
          ...enemy,
          winRate: rate(enemy.victories, enemy.encounters),
          meanTurns: enemy.encounters ? round(turns / enemy.encounters) : null,
        }))
        .sort((a, b) => b.encounters - a.encounters || a.enemy.localeCompare(b.enemy)),
    },
  };
}

function buildRunProgression(careers: CompletedCareer[]): AgentRunProgression {
  const pairs = careers
    .filter((career) => career.outcomes.length >= 2)
    .map((career) => {
      const first = career.outcomes[0]?.rooms ?? 0;
      const final = career.outcomes.at(-1)?.rooms ?? first;
      return { first, final };
    });
  const deltas = pairs.map(({ first, final }) => final - first);
  return {
    careers: pairs.length,
    firstRunMeanRooms: mean(pairs.map(({ first }) => first)),
    finalRunMeanRooms: mean(pairs.map(({ final }) => final)),
    meanRoomDelta: mean(deltas),
    improved: deltas.filter((delta) => delta > 0).length,
    worsened: deltas.filter((delta) => delta < 0).length,
    tied: deltas.filter((delta) => delta === 0).length,
  };
}

function buildRunOutcomes(careers: CompletedCareer[]): AgentRunOutcomeMetric[] {
  const runCount = Math.max(0, ...careers.map((career) => career.outcomes.length));
  return Array.from({ length: runCount }, (_, run) => {
    const outcomes = careers.map((career) => career.outcomes[run]).filter((outcome) => outcome !== undefined);
    const victories = outcomes.filter((outcome) => outcome.outcome === "victory").length;
    return {
      run: run + 1,
      runs: outcomes.length,
      victories,
      defeats: outcomes.filter((outcome) => outcome.outcome === "defeat").length,
      victoryRate: rate(victories, outcomes.length),
      meanRooms: mean(outcomes.map((outcome) => outcome.rooms)),
    };
  });
}

function buildFirstVictoryRun(careers: CompletedCareer[]): { distribution: Record<string, number>; neverWon: number } {
  const distribution: Record<string, number> = {};
  let neverWon = 0;
  for (const career of careers) {
    const first = career.outcomes.findIndex((outcome) => outcome.outcome === "victory");
    if (first < 0) neverWon += 1;
    else distribution[String(first + 1)] = (distribution[String(first + 1)] ?? 0) + 1;
  }
  return { distribution, neverWon };
}

function buildDeckCohesion(careers: CompletedCareer[]): AgentDeckCohesion {
  const samples: Array<{ hero: CompletedCareer["config"]["hero"]; keywordCounts: Record<string, number> }> = [];
  for (const career of careers) {
    const byRun = new Map<number, (typeof career.telemetry.runSnapshots)[number]>();
    for (const snapshot of career.telemetry.runSnapshots ?? []) {
      const previous = byRun.get(snapshot.run);
      if (
        !previous ||
        snapshot.rooms > previous.rooms ||
        (snapshot.rooms === previous.rooms && snapshot.step >= previous.step)
      )
        byRun.set(snapshot.run, snapshot);
    }
    for (const snapshot of byRun.values())
      samples.push({ hero: career.config.hero, keywordCounts: snapshot.keywordCounts });
  }
  const totalKeywords = samples.reduce(
    (sum, sample) => sum + Object.values(sample.keywordCounts).reduce((a, b) => a + b, 0),
    0,
  );
  if (!samples.length || totalKeywords === 0)
    return { samples: samples.length, heroKeywordShare: null, dominantKeywordShare: null, topKeywords: [] };
  const allKeywords = new Map<string, number>();
  let heroKeywordCount = 0;
  for (const sample of samples) {
    for (const [keyword, count] of Object.entries(sample.keywordCounts)) {
      allKeywords.set(keyword, (allKeywords.get(keyword) ?? 0) + count);
      if ((characters[sample.hero].keywords as readonly string[]).includes(keyword)) heroKeywordCount += count;
    }
  }
  const sorted = [...allKeywords.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    samples: samples.length,
    heroKeywordShare: characters[samples[0]!.hero].keywords.length ? rate(heroKeywordCount, totalKeywords) : null,
    dominantKeywordShare: rate(sorted[0]?.[1] ?? 0, totalKeywords),
    topKeywords: sorted.slice(0, 5).map(([keyword, count]) => ({ keyword, count })),
  };
}

function buildSurvival(runs: CareerRun[]): AgentCohortSummary["survivalByRoom"] {
  if (!runs.length) return [];
  const maxRoom = Math.max(...runs.map((run) => run.rooms));
  const rooms =
    maxRoom <= 128
      ? Array.from({ length: maxRoom + 1 }, (_, room) => room)
      : [...new Set([0, 1, 2, 4, 8, 16, 32, 64, maxRoom].filter((room) => room <= maxRoom))];
  return rooms.map((room) => ({
    room,
    reached: runs.filter((run) => run.rooms >= room).length,
    defeats: runs.filter((run) => run.rooms === room && run.outcome === "defeat").length,
    denominator: runs.length,
    rate: rate(runs.filter((run) => run.rooms >= room).length, runs.length),
  }));
}

function buildFindings(
  cohort: string,
  careers: CompletedCareer[],
  runs: CareerRun[],
  battles: Battle[],
  terminalRooms: AgentDistribution,
  battleMetrics: AgentBattleMetrics,
  progression: AgentRunProgression,
  runOutcomes: AgentRunOutcomeMetric[],
  firstVictoryRun: Record<string, number>,
  neverWon: number,
  deckCohesion: AgentDeckCohesion,
  coverageGaps: AgentMilestoneMetric[],
): AgentFinding[] {
  const findings: AgentFinding[] = [];
  const victories = runs.filter((run) => run.outcome === "victory").length;
  const defeats = runs.filter((run) => run.outcome === "defeat").length;

  if (!careers.length) {
    findings.push({
      id: "no-completed-telemetry",
      kind: "integrity",
      priority: "high",
      confidence: "high",
      title: "No completed career telemetry is available",
      claim: "This cohort cannot support gameplay conclusions yet.",
      evidence: { cohort, completedCareers: 0 },
      interpretation: "Investigate the incomplete-career errors before using this cohort for balance analysis.",
      nextStep: "Inspect the bounded worker failure output and replay the first incomplete career.",
    });
    return findings;
  }

  if (victories === 0) {
    findings.push({
      id: "no-full-victories",
      kind: "balance-signal",
      priority: "high",
      confidence: "directional",
      title: "No full victories were observed",
      claim: "Every completed run in this cohort ended in defeat.",
      evidence: { runs: runs.length, victories, defeats },
      interpretation:
        "This may reflect campaign difficulty, the autoplay policy, or route variance; it does not isolate a balance defect.",
      nextStep: "Run the same seeds with alternate combat policies before changing enemy or card tuning.",
      selector: { seeds: [...new Set(runs.map((run) => run.seed))].slice(0, 12), outcomes: ["defeat"] },
    });
  }

  if (runOutcomes.length >= 2 && (victories > 0 || neverWon > 0)) {
    const firstVictoryTotal = Object.values(firstVictoryRun).reduce((sum, count) => sum + count, 0);
    findings.push({
      id: "first-victory-timing",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title: "First-victory timing is measurable for this cohort",
      claim: `${firstVictoryTotal}/${careers.length} careers recorded a victory; ${neverWon} careers had none within the configured run budget.`,
      evidence: {
        firstVictoryRuns: Object.entries(firstVictoryRun)
          .map(([run, count]) => `run${run}=${count}`)
          .join(", "),
        neverWon,
        runBudget: runOutcomes.length,
      },
      interpretation:
        "Use this distribution to judge whether progression feels smooth; it is not a balance gate by itself.",
      nextStep:
        "Repeat with the same seeds after policy changes and compare the first-victory distribution, not only final win rate.",
    });
  }

  if (deckCohesion.samples >= 5) {
    findings.push({
      id: "deck-archetype-cohesion",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title: "Deck/archetype cohesion is now observable",
      claim: `${deckCohesion.samples} run snapshots produced a dominant keyword share of ${deckCohesion.dominantKeywordShare ?? "n/a"}%.`,
      evidence: {
        samples: deckCohesion.samples,
        heroKeywordShare: deckCohesion.heroKeywordShare ?? "n/a",
        dominantKeywordShare: deckCohesion.dominantKeywordShare ?? "n/a",
        topKeywords: deckCohesion.topKeywords.map((entry) => `${entry.keyword}=${entry.count}`).join(", "),
      },
      interpretation:
        "Low or unstable cohesion can indicate a policy mismatch; Wildcard is expected to form cohesion dynamically rather than match fixed hero keywords.",
      nextStep:
        "Compare cohesion and first-victory timing across archetype, random, and minimalist policies before changing card content.",
    });
  }

  if (defeats > 0 && terminalRooms.median !== null) {
    const lateRoom = Math.max(1, Math.round(terminalRooms.median));
    const lateDefeats = battles.filter((battle) => battle.outcome === "defeat" && battle.room >= lateRoom).length;
    // Attention heuristic only; this is deliberately not a balance gate.
    if (lateDefeats >= 5 && lateDefeats / defeats >= 0.5) {
      findings.push({
        id: "late-run-attrition",
        kind: "balance-signal",
        priority: "high",
        confidence: "directional",
        title: "Defeats concentrate in the later half of runs",
        claim: `${lateDefeats}/${defeats} defeat battles occurred at or after room ${lateRoom}, the cohort median terminal room.`,
        evidence: {
          lateDefeats,
          totalDefeats: defeats,
          thresholdRoom: lateRoom,
          medianTerminalRoom: terminalRooms.median,
        },
        interpretation:
          "The observed bottleneck may be combat scaling, attrition between recovery points, route selection, or autoplay strategy.",
        nextStep: "Compare alternate combat policies and inspect state snapshots immediately before late defeats.",
        selector: selectorForDefeats(battles, lateRoom),
      });
    }
  }

  const bossCandidates = battleMetrics.byEnemy.filter((enemy) => enemy.boss && enemy.encounters >= 5);
  const weakestBoss = [...bossCandidates].sort((a, b) => a.winRate - b.winRate)[0];
  if (weakestBoss && weakestBoss.winRate < 85) {
    findings.push({
      id: "boss-pressure",
      kind: "balance-signal",
      priority: "medium",
      confidence: "directional",
      title: `${weakestBoss.enemy} is the weakest sufficiently sampled boss`,
      claim: `${weakestBoss.victories}/${weakestBoss.encounters} encounters were victories (${weakestBoss.winRate}%).`,
      evidence: {
        enemy: weakestBoss.enemy,
        encounters: weakestBoss.encounters,
        winRate: weakestBoss.winRate,
        meanTurns: weakestBoss.meanTurns ?? "n/a",
      },
      interpretation:
        "This is an investigation target, not a tuning verdict; the autoplay policy and encounter selection may contribute.",
      nextStep: "Rerun this cohort with a defensive policy and inspect the boss-start state before changing the boss.",
      selector: { enemies: [weakestBoss.enemy] },
    });
  }

  if (progression.careers > 0 && progression.meanRoomDelta !== null && progression.meanRoomDelta !== 0) {
    findings.push({
      id: "run-progression-lift",
      kind: "progression-signal",
      priority: "medium",
      confidence: "directional",
      title:
        progression.meanRoomDelta > 0
          ? "Later runs reach farther than first runs"
          : "Later runs reach fewer rooms than first runs",
      claim: `The final run changed terminal room count by ${progression.meanRoomDelta > 0 ? "+" : ""}${progression.meanRoomDelta} rooms on average.`,
      evidence: {
        careersCompared: progression.careers,
        firstRunMeanRooms: progression.firstRunMeanRooms ?? "n/a",
        finalRunMeanRooms: progression.finalRunMeanRooms ?? "n/a",
        improved: progression.improved,
        worsened: progression.worsened,
        tied: progression.tied,
      },
      interpretation:
        "The signal is compatible with meaningful meta-progression, but runs share a career and are not independent samples.",
      nextStep:
        "Repeat with more sequential runs and separate progression effects from seed variance with paired fresh-save cohorts.",
    });
  }

  if (coverageGaps.length) {
    const names = coverageGaps.map((gap) => gap.kind).join(", ");
    findings.push({
      id: "progression-coverage-gaps",
      kind: "coverage-gap",
      priority: "low",
      confidence: "high",
      title: "Several progression systems were not consistently reached",
      claim: `The fresh-save sample has incomplete exposure to: ${names}.`,
      evidence: Object.fromEntries(coverageGaps.slice(0, 6).map((gap) => [gap.kind, `${gap.reached}/${gap.careers}`])),
      interpretation: "This is a measurement gap, not evidence that those systems are broken or unaffordable.",
      nextStep:
        "Use labeled targeted fixtures for homestead and crafting coverage, keeping them separate from fresh-save balance rates.",
    });
  }

  return findings;
}

function buildCohortSummary(cohort: string, cohortResults: CareerResult[]): AgentCohortSummary {
  const careers = cohortResults.filter((result): result is CompletedCareer => result.status === "completed");
  const runs = careers.flatMap((career) =>
    career.outcomes.map((outcome, run) => ({ ...outcome, seed: career.config.seed, run })),
  );
  const { battles, metrics: battleMetrics } = buildBattles(careers);
  const terminalRooms = distribution(runs.map((run) => run.rooms));
  const terminalGold = distribution(runs.map((run) => run.gold));
  const milestones = buildMilestones(careers);
  const coverageGaps = milestones.filter((milestone) => milestone.reached < milestone.careers);
  const progression = buildRunProgression(careers);
  const runOutcomes = buildRunOutcomes(careers);
  const firstVictory = buildFirstVictoryRun(careers);
  const deckCohesion = buildDeckCohesion(careers);
  const findings = buildFindings(
    cohort,
    careers,
    runs,
    battles,
    terminalRooms,
    battleMetrics,
    progression,
    runOutcomes,
    firstVictory.distribution,
    firstVictory.neverWon,
    deckCohesion,
    coverageGaps,
  );
  const outcomes = Object.fromEntries(
    [...new Set(runs.map((run) => run.outcome))].map((outcome) => [
      outcome,
      runs.filter((run) => run.outcome === outcome).length,
    ]),
  );
  return {
    cohort,
    planned: cohortResults.length,
    completed: careers.length,
    incomplete: cohortResults.length - careers.length,
    runs: runs.length,
    sampleSeeds: [...new Set(cohortResults.map((result) => result.config.seed))].slice(0, 12),
    outcomes,
    terminalRooms,
    terminalGold,
    survivalByRoom: buildSurvival(runs),
    battles: battleMetrics,
    progression,
    runOutcomes,
    firstVictoryRun: firstVictory.distribution,
    neverWon: firstVictory.neverWon,
    deckCohesion,
    milestones,
    coverageGaps,
    findings,
  };
}

function compactError(error: string): string {
  return error.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function buildAgentPlaythroughSummary(
  results: CareerResult[],
  options: AgentSummaryOptions = {},
): AgentPlaythroughSummary {
  const groups = new Map<string, CareerResult[]>();
  for (const result of results) {
    const cohort = careerCohort(result);
    groups.set(cohort, [...(groups.get(cohort) ?? []), result]);
  }
  const cohorts = [...groups].map(([cohort, cohortResults]) => buildCohortSummary(cohort, cohortResults));
  const workerFailures = (options.workerFailures ?? []).filter(Boolean).slice(0, 3);
  const findings: AgentFinding[] = cohorts.flatMap((cohort) =>
    cohort.findings.map((finding) => ({ ...finding, cohort: cohort.cohort })),
  );
  if (workerFailures.length) {
    findings.unshift({
      id: "worker-failures",
      kind: "integrity",
      priority: "high",
      confidence: "high",
      title: "One or more careers failed before telemetry completed",
      claim: `${workerFailures.length} worker failure${workerFailures.length === 1 ? "" : "s"} require investigation.`,
      evidence: Object.fromEntries(
        workerFailures.map((failure, index) => [`failure${index + 1}`, compactError(failure)]),
      ),
      interpretation:
        "Incomplete careers are excluded from gameplay-rate findings and should not be counted as defeats.",
      nextStep: "Replay the first incomplete career using its preserved bundle.",
    });
  }
  const heroCohorts = cohorts
    .map((cohort) => ({ cohort, hero: cohort.cohort.split("/")[1] ?? "unknown" }))
    .filter((entry) => entry.hero !== "unknown");
  if (new Set(heroCohorts.map((entry) => entry.hero)).size >= 2) {
    const heroRates = heroCohorts.map(({ cohort, hero }) => {
      const victories = cohort.runOutcomes.reduce((sum, run) => sum + run.victories, 0);
      const runs = cohort.runOutcomes.reduce((sum, run) => sum + run.runs, 0);
      return { hero, rate: rate(victories, runs), runs };
    });
    const weakest = [...heroRates].sort((a, b) => a.rate - b.rate)[0]!;
    const strongest = [...heroRates].sort((a, b) => b.rate - a.rate)[0]!;
    findings.unshift({
      id: "hero-variance",
      kind: "balance-signal",
      priority: "high",
      confidence: "directional",
      title: "Hero victory rates vary across the supplied cohorts",
      claim: `${strongest.hero} is at ${strongest.rate}% and ${weakest.hero} is at ${weakest.rate}% across paired cohort runs.`,
      evidence: {
        heroes: heroRates.map((entry) => `${entry.hero}=${entry.rate}%/${entry.runs}`).join(", "),
        spread: round(strongest.rate - weakest.rate),
      },
      interpretation:
        "Targeted cohorts identify a balance signal but do not establish earned unlock or fresh-save progression parity.",
      nextStep: "Compare adaptive policy results on the same seed manifest before changing any hero content.",
    });
  }
  const recommendations = [
    ...new Set(
      findings
        .map((finding) => finding.nextStep)
        .concat(
          cohorts.length > 1
            ? "Compare cohorts with the same seed manifest before making cross-hero or cross-mode balance changes."
            : "Broaden the next sweep across heroes, modes, or combat policies while keeping seed lists paired.",
        ),
    ),
  ];
  return {
    version: 1,
    planned: options.planned ?? results.length,
    completed: results.filter((result) => result.status === "completed").length,
    incomplete: results.filter((result) => result.status !== "completed").length,
    ...(options.codeIdentity ? { codeIdentity: options.codeIdentity } : {}),
    cohorts,
    findings,
    recommendations,
    artifacts: {
      reportJson: "playthrough.json",
      reportHtml: "playthrough.html",
      summaryJson: "agent-summary.json",
      summaryMarkdown: "agent-summary.md",
      careerBundles: "career-<index>-<seed>.json",
      journals: "career-<index>-<seed>.journal.jsonl",
    },
  };
}

function markdownText(value: string): string {
  return value.replace(/[`\r\n]/g, " ").trim();
}

export function renderAgentPlaythroughSummaryMarkdown(summary: AgentPlaythroughSummary): string {
  const lines = [
    "# Agent playthrough brief",
    "",
    `- Careers: ${summary.completed}/${summary.planned} completed; ${summary.incomplete} incomplete`,
    `- Cohorts: ${summary.cohorts.length}`,
    "- Balance findings are observations and hypotheses, not calibrated pass/fail gates.",
    "",
    "## Findings",
    "",
  ];
  if (!summary.findings.length) lines.push("No findings were generated.", "");
  for (const finding of summary.findings) {
    lines.push(`### [${finding.priority.toUpperCase()}] ${finding.title}`);
    lines.push(`- Claim: ${markdownText(finding.claim)}`);
    lines.push(`- Confidence: ${finding.confidence}`);
    lines.push(
      `- Evidence: ${Object.entries(finding.evidence)
        .map(([key, value]) => `${key}=${markdownText(String(value))}`)
        .join("; ")}`,
    );
    lines.push(`- Interpretation: ${markdownText(finding.interpretation)}`);
    lines.push(`- Next step: ${markdownText(finding.nextStep)}`);
    if (finding.selector) lines.push(`- Evidence selector: \`${JSON.stringify(finding.selector)}\``);
    lines.push("");
  }
  lines.push("## Cohort metrics", "");
  for (const cohort of summary.cohorts) {
    lines.push(`### ${cohort.cohort}`);
    lines.push(
      `- Runs: ${cohort.runs}; terminal rooms mean/median: ${cohort.terminalRooms.mean ?? "n/a"}/${cohort.terminalRooms.median ?? "n/a"}; range: ${cohort.terminalRooms.min ?? "n/a"}-${cohort.terminalRooms.max ?? "n/a"}`,
    );
    const survivalCheckpoints = [12, 16, 20]
      .map((room) => cohort.survivalByRoom.find((point) => point.room === room))
      .filter((point): point is NonNullable<typeof point> => point !== undefined)
      .map((point) => `room ${point.room}: ${point.reached}/${point.denominator} (${point.rate}%)`);
    if (survivalCheckpoints.length) lines.push(`- Survival checkpoints: ${survivalCheckpoints.join("; ")}`);
    if (cohort.runOutcomes.length)
      lines.push(
        `- Victory by run: ${cohort.runOutcomes.map((run) => `R${run.run} ${run.victories}/${run.runs} (${run.victoryRate}%)`).join("; ")}`,
      );
    const firstVictory = Object.entries(cohort.firstVictoryRun)
      .map(([run, count]) => `R${run}=${count}`)
      .join(", ");
    if (firstVictory || cohort.neverWon)
      lines.push(`- First victories: ${firstVictory || "none"}; never won: ${cohort.neverWon}`);
    if (cohort.deckCohesion.samples)
      lines.push(
        `- Deck cohesion: ${cohort.deckCohesion.dominantKeywordShare ?? "n/a"}% dominant keyword share; hero-keyword share ${cohort.deckCohesion.heroKeywordShare ?? "n/a"}%`,
      );
    lines.push(
      `- Battles: ${cohort.battles.victories}/${cohort.battles.encounters} victories (${cohort.battles.winRate}%); bosses: ${cohort.battles.bosses.victories}/${cohort.battles.bosses.encounters} (${cohort.battles.bosses.winRate}%)`,
    );
    lines.push(
      `- Progression: first-to-final room delta ${cohort.progression.meanRoomDelta ?? "n/a"}; improved/worsened/tied ${cohort.progression.improved}/${cohort.progression.worsened}/${cohort.progression.tied}`,
    );
    lines.push("");
  }
  lines.push(
    "## Recommended next experiments",
    "",
    ...summary.recommendations.map((recommendation) => `- ${markdownText(recommendation)}`),
    "",
  );
  lines.push(
    "## Evidence artifacts",
    "",
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Detailed JSON: \`${summary.artifacts.reportJson}\``,
    `- Interactive report: \`${summary.artifacts.reportHtml}\``,
    `- Raw career bundles: \`${summary.artifacts.careerBundles}\``,
    `- Raw journals: \`${summary.artifacts.journals}\``,
    "",
  );
  return `${lines.join("\n")}\n`;
}
