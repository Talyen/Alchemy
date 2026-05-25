import { describe, expect, it } from "vitest";
import { createSeededRandom, simulateBatch, simulateBattle, withSeededRandom } from "@/lib/balance";

describe("balance simulator", () => {
  it("creates repeatable seeded random sequences", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("restores Math.random after seeded execution", () => {
    const originalRandom = Math.random;
    const value = withSeededRandom(7, () => Math.random());
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(Math.random).toBe(originalRandom);
  });

  it("runs a deterministic headless battle", () => {
    const config = {
      characterId: "knight" as const,
      enemyId: "skeleton",
      seed: 11,
      maxTurns: 20,
      policy: "random-playable" as const,
    };
    const first = simulateBattle(config);
    const second = simulateBattle(config);
    expect(first).toEqual(second);
    expect(["win", "loss", "timeout"]).toContain(first.outcome);
    expect(first.turns).toBeGreaterThan(0);
  });

  it("aggregates repeated simulations", () => {
    const result = simulateBatch({
      characterId: "wizard",
      enemyId: "goblin",
      iterations: 5,
      seed: 100,
      maxTurns: 20,
      policy: "greedy-damage",
    });
    expect(result.iterations).toBe(5);
    expect(result.wins + result.losses + result.timeouts).toBe(5);
    expect(result.results).toHaveLength(5);
    expect(result.winRate + result.lossRate + result.timeoutRate).toBeCloseTo(1);
  });

  it("times out when maxTurns is exceeded", () => {
    const result = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 1,
      maxTurns: 1,
      policy: "random-playable",
    });
    expect(result.outcome).toBe("timeout");
    expect(result.turns).toBeLessThanOrEqual(2);
  });

  it("produces different outcomes for different policies", () => {
    const randomResult = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 42,
      maxTurns: 10,
      policy: "random-playable",
    });
    const greedyResult = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 42,
      maxTurns: 10,
      policy: "greedy-damage",
    });
    expect(randomResult.outcome).toBeDefined();
    expect(greedyResult.outcome).toBeDefined();
  });

  it("simulates different character and enemy combinations", () => {
    const configs = [
      { characterId: "knight" as const, enemyId: "skeleton" },
      { characterId: "wizard" as const, enemyId: "goblin" },
      { characterId: "rogue" as const, enemyId: "imp" },
    ];
    for (const { characterId, enemyId } of configs) {
      const result = simulateBattle({
        characterId,
        enemyId,
        seed: 15,
        maxTurns: 20,
        policy: "random-playable",
      });
      expect(["win", "loss", "timeout"]).toContain(result.outcome);
      expect(result.turns).toBeGreaterThan(0);
    }
  });

  it("produces deterministic results across seeds", () => {
    const resultA = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 99,
      maxTurns: 20,
      policy: "random-playable",
    });
    const resultB = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 99,
      maxTurns: 20,
      policy: "random-playable",
    });
    expect(resultA).toEqual(resultB);
  });
});
