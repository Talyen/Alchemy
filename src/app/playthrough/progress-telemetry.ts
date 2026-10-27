import type { CareerResult } from "./types";

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

/** Reports observations only; no inferred balance thresholds or simulated rules. */
export function summarizeProgress(results: CareerResult[]) {
  const groups = new Map<string, CareerResult[]>();
  for (const result of results) {
    const key = careerCohort(result);
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  return [...groups].map(([cohort, careers]) => {
    const complete = careers.filter((career) => career.status === "completed");
    const runs = complete.flatMap((career) => career.outcomes);
    const maxRooms = Math.max(0, ...runs.map((run) => run.rooms));
    const mortality = Array.from({ length: maxRooms + 1 }, (_, room) => {
      let reached = 0;
      let defeats = 0;
      for (const run of runs) {
        if (run.rooms >= room) reached++;
        if (run.rooms === room && run.outcome === "defeat") defeats++;
      }
      return { room, reached, defeats, denominator: runs.length };
    });
    const bossIds = new Set<string>();
    const enemyStats = new Map<string, { reachedCareers: number; encounters: number; victories: number }>();
    for (const career of complete) {
      const encountered = new Set<string>();
      for (const battle of career.telemetry.battles) {
        if (battle.boss) bossIds.add(battle.enemy);
        const stats = enemyStats.get(battle.enemy) ?? { reachedCareers: 0, encounters: 0, victories: 0 };
        stats.encounters++;
        if (battle.outcome === "victory") stats.victories++;
        if (!encountered.has(battle.enemy)) {
          encountered.add(battle.enemy);
          stats.reachedCareers++;
        }
        enemyStats.set(battle.enemy, stats);
      }
    }
    const bosses = [...bossIds].map((enemy) => ({
      enemy,
      reachedCareers: enemyStats.get(enemy)!.reachedCareers,
      careers: complete.length,
      encounters: enemyStats.get(enemy)!.encounters,
      victories: enemyStats.get(enemy)!.victories,
    }));
    const milestones = [
      "talent",
      "building",
      "farm",
      "research",
      "bond",
      "equip",
      "equip-trinket",
      "craft",
      "salvage",
    ].map((kind) => {
      const firstRuns: number[] = [];
      for (const career of complete) {
        let first: number | undefined;
        for (const [key, run] of Object.entries(career.telemetry.milestones)) {
          if (key.startsWith(`${kind}:`)) first = first === undefined ? run + 1 : Math.min(first, run + 1);
        }
        if (first !== undefined) firstRuns.push(first);
      }
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
