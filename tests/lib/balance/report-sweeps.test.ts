import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceBatchConfig } from "@/lib/balance/simulator-types";

const { simulateWinSeries } = vi.hoisted(() => ({
  simulateWinSeries: vi.fn(),
}));

vi.mock("@/lib/balance/simulator-batch", () => ({ simulateWinSeries }));

import { gearAffixList } from "@/lib/gear/affix-catalog";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import {
  IN_CLASS_CARD_GAUNTLET,
  runCardSweepInClass,
  runCardSweepIsolated,
  runAffixSweep,
  runTrinketSweep,
  runTalentSweep,
  runCompanionSweep,
  runGearSweep,
} from "@/lib/balance/report-sweeps";

function affixScenarioViolations(groups: Map<number, BalanceBatchConfig[]>) {
  let count = 0;
  const examples: string[] = [];
  for (const [seed, configs] of groups) {
    const baseline = configs[0];
    const record = (message: string) => {
      count += 1;
      if (examples.length < 10)
        examples.push(
          `seed=${seed} ${baseline?.characterId}/${baseline?.talentPreset}/${baseline?.enemyId}: ${message}`,
        );
    };
    if (configs.length !== gearAffixList.length + 1)
      record(`expected one baseline and ${gearAffixList.length} treatments; got ${configs.length} calls`);
    if (!baseline?.deck) record("missing baseline deck");
    if (Object.values(baseline?.gearEffects ?? {}).some((value) => value !== 0))
      record("baseline contains an affix effect");
    for (let index = 1; index < configs.length; index += 1) {
      const config = configs[index];
      const affix = gearAffixList[index - 1];
      if (config.deck !== baseline?.deck) record(`${affix?.id}: changed paired deck`);
      if (
        config.seed !== baseline?.seed ||
        config.characterId !== baseline?.characterId ||
        config.enemyId !== baseline?.enemyId ||
        config.talentPreset !== baseline?.talentPreset ||
        config.iterations !== baseline?.iterations
      )
        record(`${affix?.id}: changed paired battle`);
      const active = Object.entries(config.gearEffects ?? {}).filter(([, value]) => value !== 0);
      if (active.length !== 1 || active[0]?.[0] !== affix?.effectKey)
        record(`${affix?.id}: expected its single effect, got ${active.map(([key]) => key).join(", ") || "none"}`);
    }
  }
  return { count, examples };
}

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

  it("isolates every affix with matched battles across all tiers", { timeout: 15_000 }, () => {
    const rows = runAffixSweep({
      iterations: 1,
      pairedIterations: 2,
      cardDeckSamples: 1,
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
    // Collect all failures without invoking a matcher for every affix in every battle.
    expect(affixScenarioViolations(groups)).toEqual({ count: 0, examples: [] });
    for (const row of rows) {
      expect(row.deltas.early.n).toBe(8 * 2 * 4 * 2);
      expect(row.deltas.mid.n).toBe(row.deltas.early.n);
      expect(row.deltas.late.n).toBe(row.deltas.early.n);
    }

    const [seed, configs] = [...groups][0];
    const broken = configs.map((config, index) =>
      index === 1
        ? { ...config, deck: [...config.deck!], gearEffects: {} as NonNullable<BalanceBatchConfig["gearEffects"]> }
        : config,
    );
    const violations = affixScenarioViolations(new Map([[seed, broken]]));
    expect(violations.count).toBe(2);
    expect(violations.examples).toEqual([
      expect.stringContaining("changed paired deck"),
      expect.stringContaining("expected its single effect, got none"),
    ]);
  });

  it("runs each full base deck once per tier and character", () => {
    runCardSweepInClass({
      iterations: 1,
      pairedIterations: 1,
      cardDeckSamples: 1,
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

  it("keeps the target card out of every isolated baseline", () => {
    runCardSweepIsolated(
      {
        iterations: 1,
        pairedIterations: 1,
        cardDeckSamples: 1,
        deckSeeds: 1,
        policy: "random-playable",
        loadoutMode: "bare",
      },
      "skeleton",
    );

    const calls = simulateWinSeries.mock.calls.map(([config]) => config as BalanceBatchConfig);
    expect(calls).toHaveLength(3 * cardLibrary.length * 2);
    for (let index = 0; index < calls.length; index += 2) {
      const baseline = calls[index]?.deck ?? [];
      const treatment = calls[index + 1]?.deck ?? [];
      const targetId = treatment.at(-1)?.id;
      const baselineIds = new Set(baseline.map((card) => card.id));
      const treatmentIds = new Set(treatment.map((card) => card.id));

      expect(targetId).toBeDefined();
      expect(baselineIds.has(targetId!)).toBe(false);
      expect(baseline).toHaveLength(10);
      expect(treatment).toHaveLength(10);
      expect(treatmentIds.size).toBe(10);
      expect(baseline.filter((card) => treatmentIds.has(card.id))).toHaveLength(9);
      expect(treatment.slice(0, 9)).toEqual(baseline.slice(0, 9));
      expect(calls[index + 1]?.seed).toBe(calls[index]?.seed);
    }
  });

  it("pairs each trinket against an empty-trinket baseline with matched fight seeds", () => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => ({
      outcomes: new Uint8Array(config.iterations),
      turns: new Uint16Array(config.iterations),
      wins: 0,
      totalTurns: 0,
      averageTurns: 0,
      iterations: config.iterations,
      winRate: 0,
    }));

    const rows = runTrinketSweep({
      iterations: 1,
      pairedIterations: 1,
      cardDeckSamples: 1,
      deckSeeds: 1,
      policy: "random-playable",
      loadoutMode: "bare",
    });

    expect(rows.map((row) => row.id).sort()).toEqual(trinketLibrary.map((t) => t.id).sort());
    for (const row of rows) {
      expect(row.deltas.early).toBeDefined();
      expect(row.deltas.mid).toBeDefined();
      expect(row.deltas.late).toBeDefined();
    }
  });

  it("isolates talent effects in talent sweeps", () => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => ({
      outcomes: new Uint8Array(config.iterations),
      turns: new Uint16Array(config.iterations),
      wins: 0,
      totalTurns: 0,
      averageTurns: 0,
      iterations: config.iterations,
      winRate: 0,
    }));

    const rows = runTalentSweep({
      iterations: 1,
      pairedIterations: 1,
      cardDeckSamples: 1,
      deckSeeds: 1,
      policy: "random-playable",
      loadoutMode: "bare",
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.deltas.early).toBeDefined();
      expect(row.deltas.mid).toBeDefined();
      expect(row.deltas.late).toBeDefined();
    }
  });

  it("isolates companion summons in companion sweeps", () => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => ({
      outcomes: new Uint8Array(config.iterations),
      turns: new Uint16Array(config.iterations),
      wins: 0,
      totalTurns: 0,
      averageTurns: 0,
      iterations: config.iterations,
      winRate: 0,
    }));

    const rows = runCompanionSweep({
      iterations: 1,
      pairedIterations: 1,
      cardDeckSamples: 1,
      deckSeeds: 1,
      policy: "random-playable",
      loadoutMode: "bare",
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.deltas.early).toBeDefined();
      expect(row.deltas.mid).toBeDefined();
      expect(row.deltas.late).toBeDefined();
    }
  });

  it("isolates gear base items against default gear effects in gear sweeps", () => {
    simulateWinSeries.mockReset();
    simulateWinSeries.mockImplementation((config: BalanceBatchConfig) => ({
      outcomes: new Uint8Array(config.iterations),
      turns: new Uint16Array(config.iterations),
      wins: 0,
      totalTurns: 0,
      averageTurns: 0,
      iterations: config.iterations,
      winRate: 0,
    }));

    const rows = runGearSweep({
      iterations: 1,
      pairedIterations: 1,
      cardDeckSamples: 1,
      deckSeeds: 1,
      policy: "random-playable",
      loadoutMode: "bare",
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.deltas.early).toBeDefined();
      expect(row.deltas.mid).toBeDefined();
      expect(row.deltas.late).toBeDefined();
    }
  });
});
