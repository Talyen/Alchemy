import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

const { simulateWinSeries } = vi.hoisted(() => ({
  simulateWinSeries: vi.fn(),
}));

vi.mock("@/lib/balance/simulator-batch", () => ({ simulateWinSeries }));

import { gearAffixList } from "@/lib/gear/affix-catalog";
import { IN_CLASS_CARD_GAUNTLET, runCardSweepInClass, runAffixSweep } from "@/lib/balance/report-sweeps";

describe("runCardSweepInClass", () => {
  beforeEach(() => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => ({
      outcomes: new Uint8Array(config.iterations),
      wins: 0,
      iterations: config.iterations,
      winRate: 0,
    }));
  });

  it("isolates every affix with matched battles across all tiers", () => {
    const rows = runAffixSweep({
      iterations: 1,
      trinketIterations: 2,
      cardIterations: 1,
      deckSeeds: 2,
      policy: "random-playable",
      loadoutMode: "bare",
    });
    expect(rows.map((row) => row.id).sort()).toEqual(gearAffixList.map((affix) => affix.id).sort());
    const groups = new Map<number, BalanceBatchConfig[]>();
    for (const [config] of simulateWinSeries.mock.calls) {
      const group = groups.get(config.seed!) ?? [];
      group.push(config);
      groups.set(config.seed!, group);
    }
    expect(groups.size).toBe(3 * 8 * 2 * 4);
    for (const configs of groups.values()) {
      expect(configs).toHaveLength(gearAffixList.length + 1);
      expect(configs.every((config) => config.deck === configs[0]?.deck)).toBe(true);
      for (const config of configs.slice(1)) {
        expect(Object.values(config.gearEffects!).filter((value) => value !== 0)).toHaveLength(1);
      }
    }
    for (const row of rows) {
      expect(row.deltas.early.n).toBe(8 * 2 * 4 * 2);
      expect(row.deltas.mid.n).toBe(row.deltas.early.n);
      expect(row.deltas.late.n).toBe(row.deltas.early.n);
    }
  });

  it("runs each full base deck once per tier and character", () => {
    runCardSweepInClass({
      iterations: 1,
      trinketIterations: 1,
      cardIterations: 1,
      deckSeeds: 1,
      policy: "random-playable",
      loadoutMode: "bare",
      appliesFightPacing: false,
    });

    const callsBySeed = new Map<number, BalanceBatchConfig[]>();
    for (const [config] of simulateWinSeries.mock.calls) {
      const seed = config.seed ?? 0;
      const calls = callsBySeed.get(seed) ?? [];
      calls.push(config);
      callsBySeed.set(seed, calls);
    }

    expect(callsBySeed.size).toBe(24 * IN_CLASS_CARD_GAUNTLET.length);
    for (const calls of callsBySeed.values()) {
      const baseDeck = calls[0]?.deck;
      expect(baseDeck).toBeDefined();
      expect(calls.filter((config) => config.deck === baseDeck)).toHaveLength(1);
      expect(
        calls.slice(1).every((config) => Math.abs((config.deck?.length ?? 0) - (baseDeck?.length ?? 0)) === 1),
      ).toBe(true);
    }
  });
});
