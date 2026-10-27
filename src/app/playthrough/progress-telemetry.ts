import type { CareerResult } from "./types";
import { MILESTONE_KINDS } from "./agent-report-types";

/** One sample per career, even when it reached several milestones of a kind. */
export function firstMilestoneRuns(careers: readonly CareerResult[]) {
  const entries = careers.map((career) => Object.entries(career.telemetry.milestones));
  return MILESTONE_KINDS.map((kind) => {
    const firstRuns: number[] = [];
    for (const career of entries) {
      let first: number | undefined;
      for (const [key, run] of career) {
        if (key.startsWith(`${kind}:`)) first = first === undefined ? run + 1 : Math.min(first, run + 1);
      }
      if (first !== undefined) firstRuns.push(first);
    }
    return { kind, firstRuns };
  });
}

export function roomMortality(runs: ReadonlyArray<CareerResult["outcomes"][number]>, rooms: readonly number[]) {
  return rooms.map((room) => {
    let reached = 0;
    let defeats = 0;
    for (const run of runs) {
      if (run.rooms >= room) reached++;
      if (run.rooms === room && run.outcome === "defeat") defeats++;
    }
    return { room, reached, defeats, denominator: runs.length };
  });
}

/** Shared observations; the two reports choose their own presentation and rates. */
export function collectCareerBattles(careers: readonly CareerResult[]) {
  const battles: Array<CareerResult["telemetry"]["battles"][number] & { seed: number }> = [];
  const bosses = new Set<string>();
  const enemies = new Map<
    string,
    {
      enemy: string;
      boss: boolean;
      reachedCareers: number;
      encounters: number;
      victories: number;
      defeats: number;
      turns: number;
    }
  >();
  let victories = 0;
  let defeats = 0;
  let turns = 0;
  let bossEncounters = 0;
  let bossVictories = 0;
  let bossDefeats = 0;
  for (const career of careers) {
    const reached = new Set<string>();
    for (const battle of career.telemetry.battles) {
      battles.push({ ...battle, seed: career.config.seed });
      victories += Number(battle.outcome === "victory");
      defeats += Number(battle.outcome === "defeat");
      turns += battle.turns;
      if (battle.boss) {
        bosses.add(battle.enemy);
        bossEncounters++;
        bossVictories += Number(battle.outcome === "victory");
        bossDefeats += Number(battle.outcome === "defeat");
      }
      const current = enemies.get(battle.enemy) ?? {
        enemy: battle.enemy,
        boss: battle.boss,
        reachedCareers: 0,
        encounters: 0,
        victories: 0,
        defeats: 0,
        turns: 0,
      };
      current.encounters++;
      current.victories += Number(battle.outcome === "victory");
      current.defeats += Number(battle.outcome === "defeat");
      current.turns += battle.turns;
      if (!reached.has(battle.enemy)) current.reachedCareers++;
      reached.add(battle.enemy);
      enemies.set(battle.enemy, current);
    }
  }
  return { battles, bosses, enemies, victories, defeats, turns, bossEncounters, bossVictories, bossDefeats };
}

export function careerCohort(result: CareerResult): string {
  const { config } = result;
  return [
    result.cohort,
    config.hero,
    config.mode,
    config.difficulty,
    config.policy,
    config.combatPolicy,
    config.brewing ?? "legacy",
  ].join("/");
}

export function groupCareersByCohort(results: readonly CareerResult[]): Map<string, CareerResult[]> {
  const groups = new Map<string, CareerResult[]>();
  for (const result of results) {
    const key = careerCohort(result);
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  return groups;
}

/** Reports observations only; no inferred balance thresholds or simulated rules. */
export function summarizeProgress(results: CareerResult[]) {
  const groups = groupCareersByCohort(results);
  return [...groups].map(([cohort, careers]) => {
    const complete = careers.filter((career) => career.status === "completed");
    const runs = complete.flatMap((career) => career.outcomes);
    const maxRooms = Math.max(0, ...runs.map((run) => run.rooms));
    const mortality = roomMortality(
      runs,
      Array.from({ length: maxRooms + 1 }, (_, room) => room),
    );
    const { bosses: bossIds, enemies: enemyStats } = collectCareerBattles(complete);
    const bosses = [...bossIds].map((enemy) => ({
      enemy,
      reachedCareers: enemyStats.get(enemy)!.reachedCareers,
      careers: complete.length,
      encounters: enemyStats.get(enemy)!.encounters,
      victories: enemyStats.get(enemy)!.victories,
    }));
    const milestones = firstMilestoneRuns(complete).map(({ kind, firstRuns }) => {
      return {
        kind,
        reached: firstRuns.length,
        unreached: complete.length - firstRuns.length,
        careers: complete.length,
        meanFirstRunAmongReached: firstRuns.length ? firstRuns.reduce((a, b) => a + b, 0) / firstRuns.length : null,
      };
    });
    return {
      cohort,
      planned: careers.length,
      completed: complete.length,
      incomplete: careers.length - complete.length,
      runs: runs.length,
      mortality,
      bosses,
      milestones,
    };
  });
}
