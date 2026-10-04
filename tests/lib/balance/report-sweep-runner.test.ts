import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

const { simulateWinSeries } = vi.hoisted(() => ({ simulateWinSeries: vi.fn() }));
vi.mock("@/lib/balance/simulator-batch", () => ({ simulateWinSeries }));

import { runPairedSweep, type BalanceScenarioConfig } from "@/lib/balance/report-sweep-runner";
import type { ReportRunOptions } from "@/lib/balance/report-options";

const options: ReportRunOptions = {
  iterations: 2,
  pairedIterations: 2,
  cardDeckSamples: 1,
  deckSeeds: 1,
  policy: "random-playable",
  loadoutMode: "bare",
};

const reference: BalanceScenarioConfig = {
  characterId: "knight",
  enemyId: "skeleton",
  depth: 1,
  preset: "early",
  seed: 42,
  trinketIds: [],
};

describe("runPairedSweep", () => {
  beforeEach(() => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => {
      const wins = config.trinketIds?.length ? 1 : 0;
      return { outcomes: new Uint8Array([wins, wins]), turns: new Uint16Array([4, 4]) };
    });
  });

  it("runs a shared reference once and respects which side it represents", () => {
    const rows = runPairedSweep(options, [
      {
        reference,
        variants: [
          { id: "added", scenario: { ...reference, trinketIds: ["test"] } },
          { id: "removed", scenario: { ...reference, trinketIds: ["test"] }, referenceSide: "treatment" },
        ],
      },
    ]);

    expect(simulateWinSeries).toHaveBeenCalledTimes(3);
    expect(rows.map((row) => [row.id, row.deltas.early.delta, row.deltas.early.n])).toEqual([
      ["added", 1, 2],
      ["removed", -1, 2],
    ]);
  });

  it("combines repeated variants across groups without losing duration statistics or tiers", () => {
    const samples = [
      { outcomes: Uint8Array.from([1, 0]), turns: Uint16Array.from([2, 8]) },
      { outcomes: Uint8Array.from([1, 1]), turns: Uint16Array.from([3, 6]) },
      { outcomes: Uint8Array.from([1, 1]), turns: Uint16Array.from([4, 5]) },
      { outcomes: Uint8Array.from([0, 1]), turns: Uint16Array.from([7, 5]) },
      { outcomes: Uint8Array.from([0, 0]), turns: Uint16Array.from([8, 8]) },
      { outcomes: Uint8Array.from([1, 1]), turns: Uint16Array.from([4, 4]) },
    ];
    for (const sample of samples) simulateWinSeries.mockReturnValueOnce(sample);
    const groups = (["early", "early", "late"] as const).map((preset, index) => {
      const scenario = { ...reference, preset, seed: reference.seed + index };
      return { reference: scenario, variants: [{ id: "same", scenario }] };
    });
    const rows = runPairedSweep(options, groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deltas.early).toMatchObject({
      n: 4,
      delta: 0,
      baseline: 0.75,
      winRate: 0.75,
      baselineTurns: 4.75,
      treatmentTurns: 5.25,
      turnDelta: 0.5,
    });
    expect(rows[0]!.deltas.late).toMatchObject({ n: 2, delta: 1, turnDelta: -4 });
    expect(rows[0]!.deltas.mid.n).toBe(0);
  });

  it.each<Partial<BalanceScenarioConfig>>([
    { characterId: "rogue" },
    { enemyId: "goblin" },
    { depth: 2 },
    { preset: "late" },
    { seed: 43 },
    { iterations: 3 },
  ])("rejects a mismatched fight before simulation: %j", (mismatch) => {
    expect(() =>
      runPairedSweep(options, [
        {
          reference,
          variants: [{ id: "mismatch", scenario: { ...reference, ...mismatch } }],
        },
      ]),
    ).toThrow(/mismatch.*matched character, enemy, depth, tier, seed, and iterations/);
    expect(simulateWinSeries).not.toHaveBeenCalled();
  });
});
