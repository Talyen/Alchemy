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

function quantile(values: number[], probability: number): MaybeNumber {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower] ?? null;
  return round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower));
}

export function distribution(values: number[]): AgentDistribution {
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

export function selectorForDefeats(battles: Battle[], minRoom?: number): AgentEvidenceSelector {
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

export function buildMilestones(careers: CompletedCareer[]): AgentMilestoneMetric[] {
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

export function buildBattles(careers: CompletedCareer[]): { battles: Battle[]; metrics: AgentBattleMetrics } {
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

export function buildRunProgression(careers: CompletedCareer[]): AgentRunProgression {
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

export function buildRunOutcomes(careers: CompletedCareer[]): AgentRunOutcomeMetric[] {
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

export function buildSurvival(runs: CareerRun[]): AgentCohortSummary["survivalByRoom"] {
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
