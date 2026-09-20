import { describe, expect, it } from "vitest";
import { buildAgentPlaythroughSummary, renderAgentPlaythroughSummaryMarkdown } from "@/app/playthrough/agent-report";
import type { CareerResult } from "@/app/playthrough/types";

const config: CareerResult["config"] = {
  seed: 1,
  hero: "knight",
  mode: "campaign",
  difficulty: "difficulty-1",
  runs: 2,
  horizon: 12,
  maxSteps: 10000,
  maxTurns: 100,
  policy: "archetype",
  combatPolicy: "greedy-effective-damage",
};

function career(overrides: Partial<CareerResult> = {}): CareerResult {
  return {
    version: 1,
    config: { ...config, ...overrides.config },
    cohort: "fresh-save",
    status: "completed",
    journal: [
      {
        action: { kind: "play", id: "sunder", score: 4 },
        before: "raw-before-hash",
        after: "raw-after-hash",
        step: 0,
        beforeRevision: 0,
        afterRevision: 1,
        policyDraws: 0,
      },
    ],
    outcomes: [
      { outcome: "defeat", rooms: 10, gold: 12, steps: 10 },
      { outcome: "defeat", rooms: 18, gold: 24, steps: 20 },
    ],
    coverage: {},
    initialSave: {} as CareerResult["initialSave"],
    finalSave: {} as CareerResult["finalSave"],
    elapsedMs: 0,
    timings: { observationMs: 0, actionMs: 0, validationMs: 0, persistenceMs: 0 },
    saveChecks: 1,
    resumeChecks: 0,
    telemetry: {
      anomalies: {} as CareerResult["telemetry"]["anomalies"],
      cards: {},
      economy: [],
      runSnapshots: [],
      battleSnapshots: [],
      battles: [
        { enemy: "forge-golem", boss: true, outcome: "victory", turns: 20, run: 0, room: 9 },
        { enemy: "forge-golem", boss: true, outcome: "defeat", turns: 24, run: 1, room: 18 },
        { enemy: "forge-golem", boss: true, outcome: "victory", turns: 21, run: 0, room: 9 },
        { enemy: "forge-golem", boss: true, outcome: "victory", turns: 22, run: 1, room: 18 },
        { enemy: "forge-golem", boss: true, outcome: "victory", turns: 23, run: 1, room: 18 },
        { enemy: "living-armor", boss: false, outcome: "defeat", turns: 12, run: 0, room: 18 },
        { enemy: "living-armor", boss: false, outcome: "defeat", turns: 13, run: 0, room: 18 },
        { enemy: "living-armor", boss: false, outcome: "defeat", turns: 14, run: 1, room: 18 },
        { enemy: "living-armor", boss: false, outcome: "defeat", turns: 15, run: 1, room: 18 },
        { enemy: "living-armor", boss: false, outcome: "defeat", turns: 16, run: 1, room: 18 },
      ],
      milestones: { "talent:block-to-holy": 0 },
    },
    ...overrides,
  };
}

describe("agent playthrough reports", () => {
  it("derives actionable findings without exposing raw journal evidence", () => {
    const summary = buildAgentPlaythroughSummary([career(), career({ config: { ...config, seed: 2 } })], {
      planned: 2,
      codeIdentity: { head: "head", sourceHash: "hash" },
    });
    const serialized = JSON.stringify(summary);
    const markdown = renderAgentPlaythroughSummaryMarkdown(summary);

    expect(summary.version).toBe(1);
    expect(summary.cohorts[0]?.terminalRooms.mean).toBe(14);
    expect(summary.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["no-full-victories", "late-run-attrition", "boss-pressure"]),
    );
    expect(summary.artifacts.journals).toBe("career-<index>-<seed>.journal.jsonl");
    expect(serialized).not.toContain("raw-before-hash");
    expect(serialized).not.toContain("raw-after-hash");
    expect(markdown).toContain("# Agent playthrough brief");
    expect(markdown).toContain("alternate combat policies");
  });

  it("reports worker failures separately from gameplay defeats", () => {
    const summary = buildAgentPlaythroughSummary([career()], {
      planned: 2,
      workerFailures: ["worker timed out after bounded execution"],
    });

    expect(summary.incomplete).toBe(0);
    expect(summary.findings[0]?.id).toBe("worker-failures");
    expect(summary.findings[0]?.evidence.failure1).toContain("timed out");
  });
});
