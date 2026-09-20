import type { CareerResult } from "./types";

export function careerCohort(result: CareerResult): string {
  const { config } = result;
  return [result.cohort, config.hero, config.mode, config.difficulty, config.policy, config.combatPolicy].join("/");
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
    const mortality = Array.from({ length: maxRooms + 1 }, (_, room) => ({
      room,
      reached: runs.filter((run) => run.rooms >= room).length,
      defeats: runs.filter((run) => run.rooms === room && run.outcome === "defeat").length,
      denominator: runs.length,
    }));
    const bossIds = new Set(
      complete.flatMap((career) =>
        career.telemetry.battles.filter((battle) => battle.boss).map((battle) => battle.enemy),
      ),
    );
    const bosses = [...bossIds].map((enemy) => {
      const battles = complete.flatMap((career) => career.telemetry.battles.filter((battle) => battle.enemy === enemy));
      return {
        enemy,
        reachedCareers: complete.filter((career) => career.telemetry.battles.some((battle) => battle.enemy === enemy))
          .length,
        careers: complete.length,
        encounters: battles.length,
        victories: battles.filter((battle) => battle.outcome === "victory").length,
      };
    });
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
      const firstRuns = complete.flatMap((career) => {
        const reached = Object.entries(career.telemetry.milestones)
          .filter(([key]) => key.startsWith(`${kind}:`))
          .map(([, run]) => run + 1);
        return reached.length ? [Math.min(...reached)] : [];
      });
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
