import { characters } from "@/lib/game-data";
import type {
  AgentBattleMetrics,
  AgentCohortSummary,
  AgentDeckCohesion,
  AgentDistribution,
  AgentEvidenceSelector,
  AgentMilestoneMetric,
  AgentRunOutcomeMetric,
  AgentRunProgression,
  Battle,
  CareerRun,
  CompletedCareer,
  MaybeNumber,
} from "./agent-report-types";
import { MILESTONE_KINDS } from "./agent-report-types";

export function round(value: number): number {
  return Number(value.toFixed(2));
}

export function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function mean(values: number[]): MaybeNumber {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function quantile(sorted: number[], probability: number): MaybeNumber {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? null;
  return round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower));
}

export function distribution(values: number[]): AgentDistribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    q25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    mean: mean(values),
    q75: quantile(sorted, 0.75),
    max: values.length ? Math.max(...values) : null,
  };
}

export function selectorForDefeats(battles: Battle[], minRoom?: number): AgentEvidenceSelector {
  const seeds = new Set<number>();
  for (const battle of battles) {
    if (battle.outcome === "defeat" && (minRoom === undefined || battle.room >= minRoom)) {
      seeds.add(battle.seed);
      if (seeds.size === 12) break;
    }
  }
  const selector: AgentEvidenceSelector = {
    seeds: [...seeds],
    outcomes: ["defeat"],
  };
  if (minRoom !== undefined) selector.rooms = { min: minRoom };
  return selector;
}

export function buildMilestones(careers: CompletedCareer[]): AgentMilestoneMetric[] {
  const milestoneEntries = careers.map((career) => Object.entries(career.telemetry.milestones));
  return MILESTONE_KINDS.map((kind) => {
    const firstRuns: number[] = [];
    const prefix = `${kind}:`;
    for (const entries of milestoneEntries) {
      let first = Infinity;
      let reached = false;
      for (const [key, run] of entries) {
        if (!key.startsWith(prefix)) continue;
        reached = true;
        first = Math.min(first, run + 1);
      }
      if (reached) firstRuns.push(first);
    }
    return {
      kind,
      reached: firstRuns.length,
      careers: careers.length,
      rate: rate(firstRuns.length, careers.length),
      meanFirstRunAmongReached: mean(firstRuns),
    };
  });
}

export function buildBattles(careers: CompletedCareer[]): { battles: Battle[]; metrics: AgentBattleMetrics } {
  const battles: Battle[] = [];
  for (const career of careers) {
    for (const battle of career.telemetry.battles) battles.push({ ...battle, seed: career.config.seed });
  }
  const byEnemy = new Map<
    string,
    { enemy: string; boss: boolean; encounters: number; victories: number; defeats: number; turns: number }
  >();
  let victories = 0;
  let defeats = 0;
  let bossEncounters = 0;
  let bossVictories = 0;
  let bossDefeats = 0;
  let turns = 0;
  for (const battle of battles) {
    victories += battle.outcome === "victory" ? 1 : 0;
    defeats += battle.outcome === "defeat" ? 1 : 0;
    turns += battle.turns;
    if (battle.boss) {
      bossEncounters++;
      bossVictories += battle.outcome === "victory" ? 1 : 0;
      bossDefeats += battle.outcome === "defeat" ? 1 : 0;
    }
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
  return {
    battles,
    metrics: {
      encounters: battles.length,
      victories,
      defeats,
      winRate: rate(victories, battles.length),
      meanTurns: battles.length ? round(turns / battles.length) : null,
      bosses: {
        encounters: bossEncounters,
        victories: bossVictories,
        defeats: bossDefeats,
        winRate: rate(bossVictories, bossEncounters),
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

export function buildRunProgression(careers: CompletedCareer[]): AgentRunProgression {
  let count = 0;
  let firstTotal = 0;
  let finalTotal = 0;
  let deltaTotal = 0;
  let improved = 0;
  let worsened = 0;
  let tied = 0;
  for (const career of careers) {
    if (career.outcomes.length < 2) continue;
    const first = career.outcomes[0]?.rooms ?? 0;
    const final = career.outcomes.at(-1)?.rooms ?? first;
    const delta = final - first;
    count++;
    firstTotal += first;
    finalTotal += final;
    deltaTotal += delta;
    if (delta > 0) improved++;
    else if (delta < 0) worsened++;
    else if (delta === 0) tied++;
  }
  return {
    careers: count,
    firstRunMeanRooms: count ? round(firstTotal / count) : null,
    finalRunMeanRooms: count ? round(finalTotal / count) : null,
    meanRoomDelta: count ? round(deltaTotal / count) : null,
    improved,
    worsened,
    tied,
  };
}

export function buildRunOutcomes(careers: CompletedCareer[]): AgentRunOutcomeMetric[] {
  let runCount = 0;
  for (const career of careers) runCount = Math.max(runCount, career.outcomes.length);
  return Array.from({ length: runCount }, (_, run) => {
    let count = 0;
    let victories = 0;
    let defeats = 0;
    let rooms = 0;
    for (const career of careers) {
      const outcome = career.outcomes[run];
      if (outcome === undefined) continue;
      count++;
      victories += outcome.outcome === "victory" ? 1 : 0;
      defeats += outcome.outcome === "defeat" ? 1 : 0;
      rooms += outcome.rooms;
    }
    return {
      run: run + 1,
      runs: count,
      victories,
      defeats,
      victoryRate: rate(victories, count),
      meanRooms: count ? round(rooms / count) : null,
    };
  });
}

export function buildFirstVictoryRun(careers: CompletedCareer[]): {
  distribution: Record<string, number>;
  neverWon: number;
} {
  const distribution: Record<string, number> = {};
  let neverWon = 0;
  for (const career of careers) {
    const first = career.outcomes.findIndex((outcome) => outcome.outcome === "victory");
    if (first < 0) neverWon += 1;
    else distribution[String(first + 1)] = (distribution[String(first + 1)] ?? 0) + 1;
  }
  return { distribution, neverWon };
}

export function buildDeckCohesion(careers: CompletedCareer[]): AgentDeckCohesion {
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
  let totalKeywords = 0;
  const allKeywords = new Map<string, number>();
  let heroKeywordCount = 0;
  for (const sample of samples) {
    let sampleTotal = 0;
    for (const [keyword, count] of Object.entries(sample.keywordCounts)) {
      sampleTotal += count;
      allKeywords.set(keyword, (allKeywords.get(keyword) ?? 0) + count);
      if ((characters[sample.hero].keywords as readonly string[]).includes(keyword)) heroKeywordCount += count;
    }
    totalKeywords += sampleTotal;
  }
  if (!samples.length || totalKeywords === 0)
    return { samples: samples.length, heroKeywordShare: null, dominantKeywordShare: null, topKeywords: [] };
  const sorted = [...allKeywords.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    samples: samples.length,
    heroKeywordShare: characters[samples[0]!.hero].keywords.length ? rate(heroKeywordCount, totalKeywords) : null,
    dominantKeywordShare: rate(sorted[0]?.[1] ?? 0, totalKeywords),
    topKeywords: sorted.slice(0, 5).map(([keyword, count]) => ({ keyword, count })),
  };
}

export function buildSurvival(runs: CareerRun[]): AgentCohortSummary["survivalByRoom"] {
  if (!runs.length) return [];
  const maxRoom = Math.max(...runs.map((run) => run.rooms));
  const rooms =
    maxRoom <= 128
      ? Array.from({ length: maxRoom + 1 }, (_, room) => room)
      : [...new Set([0, 1, 2, 4, 8, 16, 32, 64, maxRoom].filter((room) => room <= maxRoom))];
  return rooms.map((room) => {
    let reached = 0;
    let defeats = 0;
    for (const run of runs) {
      if (run.rooms >= room) reached++;
      if (run.rooms === room && run.outcome === "defeat") defeats++;
    }
    return { room, reached, defeats, denominator: runs.length, rate: rate(reached, runs.length) };
  });
}
