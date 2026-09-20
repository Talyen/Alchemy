import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { CareerConfig, CareerResult, JournalEntry } from "@/app/playthrough/types";

const directory = mkdtempSync(resolve(tmpdir(), "alchemy-playthrough-"));
let serial = 0;
const config: CareerConfig = {
  seed: 1,
  hero: "knight",
  mode: "campaign",
  difficulty: "difficulty-1",
  runs: 2,
  horizon: 3,
  maxSteps: 10000,
  maxTurns: 100,
  policy: "archetype",
  combatPolicy: "greedy-effective-damage",
};
function career(overrides: Partial<CareerConfig> = {}, fixture?: string, replay?: JournalEntry[]) {
  const prefix = resolve(directory, String(serial++));
  writeFileSync(`${prefix}.input`, JSON.stringify({ config: { ...config, ...overrides }, fixture, replay }));
  const child = spawnSync(
    process.execPath,
    ["scripts/run-playthrough-worker.mjs", `${prefix}.input`, `${prefix}.json`, `${prefix}.journal`],
    { encoding: "utf8", timeout: 30000 },
  );
  expect(child.status, child.stderr || child.error?.message).toBe(0);
  return JSON.parse(readFileSync(`${prefix}.json`, "utf8")) as CareerResult;
}
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("headless production careers", () => {
  it("earns progression, spends it and exactly replays in a fresh process", () => {
    const result = career();
    expect(result.status, result.error).toBe("completed");
    expect(result.cohort).toBe("fresh-save");
    expect(result.outcomes).toHaveLength(2);
    expect(result.coverage.equip).toBeGreaterThan(0);
    expect(result.coverage.talent).toBeGreaterThan(0);
    expect(result.saveChecks).toBe(result.journal.length);
    const replay = career({}, undefined, result.journal);
    expect(replay.status, replay.error).toBe("completed");
    expect(replay.finalSave).toEqual(result.finalSave);
    const resumed = career({ resumeAt: 20 });
    expect(resumed.status, resumed.error).toBe("completed");
    expect(resumed.resumeChecks).toBe(1);
    expect(resumed.finalSave).toEqual(result.finalSave);
    expect(resumed.outcomes).toEqual(result.outcomes);
  }, 90000);

  it("resumes an acknowledged combat save in a fresh process", () => {
    const prefix = resolve(directory, `checkpoint-${serial++}`);
    writeFileSync(`${prefix}.input`, JSON.stringify({ config: { ...config, runs: 1 }, checkpointAt: 20 }));
    const child = spawnSync(
      process.execPath,
      ["scripts/run-playthrough-worker.mjs", `${prefix}.input`, `${prefix}.json`, `${prefix}.journal`],
      { encoding: "utf8", timeout: 30000 },
    );
    expect(child.status, child.stderr).toBe(0);
    const baseline = JSON.parse(readFileSync(`${prefix}.json`, "utf8")) as CareerResult;
    const checkpoint = JSON.parse(readFileSync(`${prefix}.json.checkpoint`, "utf8"));
    writeFileSync(
      `${prefix}.resume`,
      JSON.stringify({
        config: { ...config, runs: 1, initialSave: JSON.parse(checkpoint.bytes) },
        runtimeInputs: checkpoint.runtimeInputs,
        replay: baseline.journal.slice(20),
      }),
    );
    const resumed = spawnSync(
      process.execPath,
      ["scripts/run-playthrough-worker.mjs", `${prefix}.resume`, `${prefix}.resumed`, `${prefix}.resume-journal`],
      { encoding: "utf8", timeout: 30000 },
    );
    expect(resumed.status, resumed.stderr).toBe(0);
    const result = JSON.parse(readFileSync(`${prefix}.resumed`, "utf8")) as CareerResult;
    expect(result.status, result.error).toBe("completed");
    expect(result.finalSave).toEqual(baseline.finalSave);
  }, 45000);

  it("retains victory settlement separately from fresh-save evidence", () => {
    const result = career({ runs: 1 }, "victory-v1");
    expect(result.status, result.error).toBe("completed");
    expect(result.cohort).toBe("targeted");
    expect(result.outcomes[0]?.outcome).toBe("victory");
    expect(result.finalSave.activeRun).toBeNull();
    expect(result.finalSave.completedDifficulties.knight).toContain("difficulty-1");
  }, 45000);

  it.each(["execution", "post-commit"] as const)(
    "records and replays a controlled %s failure without retry",
    (stage) => {
      const diagnosticFault = { at: 4, stage };
      const result = career({ diagnosticFault });
      expect(result.status).toBe("incomplete");
      expect(result.journal).toHaveLength(5);
      const last = result.journal.at(-1)!;
      expect(last.stage).toBe(stage);
      expect(last.before === last.after).toBe(stage === "execution");
      const replay = career({ diagnosticFault }, undefined, result.journal);
      expect(replay.error).toBe(result.error);
      expect(replay.journal).toEqual(result.journal);
    },
    15000,
  );

  it("reports budget exhaustion as incomplete, never as defeat", () => {
    const result = career({ maxSteps: 2 });
    expect(result.status).toBe("incomplete");
    expect(result.error).toContain("budget exhausted");
    expect(result.outcomes).toHaveLength(0);
  }, 45000);

  it.each(["ranger", "rogue", "wizard", "alchemist", "warlock", "druid", "wildcard"] as const)(
    "supports targeted %s careers",
    (hero) => {
      const result = career({ hero, runs: 1 }, "unlocked-v1");
      expect(result.status, result.error).toBe("completed");
      expect(result.cohort).toBe("targeted");
    },
    15000,
  );

  it.each(["difficulty-2", "difficulty-3"] as const)(
    "supports targeted %s Campaign scaling",
    (difficulty) => {
      const result = career({ hero: "wizard", difficulty, runs: 1 }, "unlocked-v1");
      expect(result.status, result.error).toBe("completed");
      expect(result.coverage.difficulty).toBe(1);
    },
    15000,
  );

  it("exercises homestead spending from a labeled late-progression fixture", () => {
    const result = career({ runs: 1 }, "economy-v1");
    expect(result.status, result.error).toBe("completed");
    expect(result.coverage.building).toBeGreaterThan(0);
    expect(result.coverage.farm).toBeGreaterThan(0);
    expect(result.coverage.research).toBeGreaterThan(0);
    expect(result.coverage.bond).toBeGreaterThan(0);
  }, 45000);

  it.each(["wildwood", "labyrinth"] as const)(
    "supports bounded %s observations and keeps earned progress",
    (mode) => {
      const result = career({ hero: "wildcard", mode, runs: 1, horizon: 2 }, "unlocked-v1");
      expect(result.status, result.error).toBe("completed");
      expect(["horizon", "defeat"]).toContain(result.outcomes[0]?.outcome);
      expect(result.finalSave.activeRun).toBeNull();
    },
    15000,
  );
});
