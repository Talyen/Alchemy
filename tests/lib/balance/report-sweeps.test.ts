import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

const { simulateWinSeries } = vi.hoisted(() => ({
  simulateWinSeries: vi.fn(),
}));

vi.mock("@/lib/balance/simulator-batch", () => ({ simulateWinSeries }));

import { IN_CLASS_CARD_GAUNTLET, runCardSweepInClass } from "@/lib/balance/report-sweeps";

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
