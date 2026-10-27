import { expect, it } from "vitest";
import { buildBattles, buildMilestones, buildSurvival } from "@/app/playthrough/agent-report-metrics";
import { groupCareersByCohort, summarizeProgress } from "@/app/playthrough/progress-telemetry";
import type { CompletedCareer } from "@/app/playthrough/agent-report-types";
import type { CareerResult } from "@/app/playthrough/types";

function career(milestones: Record<string, number>, rooms: number, status: CareerResult["status"] = "completed") {
  return {
    cohort: "fresh-save",
    status,
    config: {
      hero: "knight",
      mode: "campaign",
      difficulty: "difficulty-1",
      policy: "random",
      combatPolicy: "random-playable",
    },
    outcomes: [{ outcome: "defeat", rooms, gold: 0, steps: 0 }],
    telemetry: { milestones, battles: [] },
  } as unknown as CareerResult;
}

it("uses the same earliest milestone per completed career while preserving report precision", () => {
  const careers = [
    career({ "talent:a": 2, "talent:b": 0, "equip-trinket:a": 1 }, 1),
    career({ "talent:c": 1 }, 2),
    career({ "talent:d": 1 }, 3),
    career({ "talent:e": 0 }, 4, "incomplete"),
  ];
  const [progress] = summarizeProgress(careers);
  expect(progress).toMatchObject({ planned: 4, completed: 3, incomplete: 1 });
  const agent = buildMilestones(careers.slice(0, 3) as CompletedCareer[]);
  expect(progress?.milestones.find(({ kind }) => kind === "talent")).toEqual({
    kind: "talent",
    reached: 3,
    unreached: 0,
    careers: 3,
    meanFirstRunAmongReached: 5 / 3,
  });
  expect(agent.find(({ kind }) => kind === "talent")).toEqual({
    kind: "talent",
    reached: 3,
    careers: 3,
    rate: 100,
    meanFirstRunAmongReached: 1.67,
  });
  expect(progress?.milestones.find(({ kind }) => kind === "equip")?.reached).toBe(0);
  expect(agent.find(({ kind }) => kind === "equip-trinket")?.reached).toBe(1);
});

it("groups careers in first-seen cohort and input order", () => {
  const first = career({}, 1);
  const other = career({}, 2);
  other.config.hero = "wizard";
  const last = career({}, 3);
  expect([...groupCareersByCohort([first, other, last]).values()]).toEqual([[first, last], [other]]);
});

it("keeps complete room tables and the agent's bounded room sampling consistent", () => {
  const careers = [career({}, 2), career({}, 200)];
  const [progress] = summarizeProgress(careers);
  const runs = careers.flatMap(({ outcomes }) => outcomes.map((outcome) => ({ ...outcome, seed: 1, run: 0 })));
  const agent = buildSurvival(runs);
  expect(progress?.mortality).toHaveLength(201);
  expect(agent.map(({ room }) => room)).toEqual([0, 1, 2, 4, 8, 16, 32, 64, 200]);
  for (const { rate: _rate, ...entry } of agent) expect(entry).toEqual(progress?.mortality[entry.room]);
  expect(agent.find(({ room }) => room === 200)?.rate).toBe(50);
});

it("preserves boss discovery order and counts careers separately from encounters", () => {
  const first = career({}, 3);
  first.config.seed = 10;
  first.telemetry.battles = [
    { enemy: "a", boss: false, outcome: "defeat", turns: 3, run: 0, room: 1 },
    { enemy: "b", boss: true, outcome: "victory", turns: 5, run: 0, room: 2 },
    { enemy: "a", boss: true, outcome: "victory", turns: 7, run: 0, room: 3 },
  ];
  const second = career({}, 1);
  second.config.seed = 20;
  second.telemetry.battles = [{ enemy: "a", boss: true, outcome: "defeat", turns: 1, run: 0, room: 1 }];
  const [progress] = summarizeProgress([first, second]);
  expect(progress?.bosses).toEqual([
    { enemy: "b", reachedCareers: 1, careers: 2, encounters: 1, victories: 1 },
    { enemy: "a", reachedCareers: 2, careers: 2, encounters: 3, victories: 1 },
  ]);
  const result = buildBattles([first, second] as CompletedCareer[]);
  expect(result.battles.map(({ seed }) => seed)).toEqual([10, 10, 10, 20]);
  expect(result.metrics).toEqual({
    encounters: 4,
    victories: 2,
    defeats: 2,
    winRate: 50,
    meanTurns: 4,
    bosses: { encounters: 3, victories: 2, defeats: 1, winRate: 66.67 },
    byEnemy: [
      { enemy: "a", boss: false, encounters: 3, victories: 1, defeats: 2, winRate: 33.33, meanTurns: 3.67 },
      { enemy: "b", boss: true, encounters: 1, victories: 1, defeats: 0, winRate: 100, meanTurns: 5 },
    ],
  });
});
