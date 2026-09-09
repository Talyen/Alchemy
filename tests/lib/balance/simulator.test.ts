import { makeTestCard } from "../../fixtures/battle";
import { describe, expect, it } from "vitest";
import { createRunStreamRng } from "@/lib/rng";
import { simulateBatch, simulateBattle } from "@/lib/balance";

describe("balance simulator", () => {
  it("creates repeatable world-stream sequences", () => {
    const first = createRunStreamRng(42, "world");
    const second = createRunStreamRng(42, "world");
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
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

  it("reports combat Gold separately from the starting purse", () => {
    const result = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 11,
      maxTurns: 1,
      loadoutMode: "bare",
      gold: 50,
      appliesFightPacing: false,
      deck: Array.from({ length: 8 }, (_, index) =>
        makeTestCard({
          id: `gold-${index}`,
          cost: 1,
          effects: [{ kind: "gain-gold", amount: 2 }],
        }),
      ),
    });
    expect(result.combatGoldEarned).toBe(result.totalCardsPlayed * 2);
    expect(result.combatGoldEarned).toBeGreaterThan(0);
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
    expect(result.turns).toBe(1);
  });

  it("produces different outcomes for different policies", () => {
    const config = {
      characterId: "knight" as const,
      enemyId: "skeleton",
      seed: 42,
      maxTurns: 10,
    };
    const randomResult = simulateBattle({ ...config, policy: "random-playable" });
    const greedyResult = simulateBattle({ ...config, policy: "greedy-damage" });
    expect(randomResult).not.toEqual(greedyResult);
    expect(randomResult.turns).toBeGreaterThan(0);
    expect(greedyResult.turns).toBeGreaterThan(0);
  });

  it("simulates different character and enemy combinations", () => {
    const configs = [
      { characterId: "knight" as const, enemyId: "skeleton" },
      { characterId: "wizard" as const, enemyId: "goblin" },
      { characterId: "rogue" as const, enemyId: "slime" },
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

describe("enemy interaction measurements", () => {
  it("records a first-turn kill without an enemy attack", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 10000 }] });
    const result = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      deck: [card],
      loadoutMode: "bare",
      seed: 1,
    });
    expect(result.outcome).toBe("win");
    expect(result.enemyAttackActions).toBe(0);
    expect(result.wonBeforeEnemyAttack).toBe(true);
    expect(result.enemyAbilityActivations).toEqual({});
  });

  it("aggregates actual attacks and distinguishes timeouts from early wins", () => {
    const batch = simulateBatch({
      characterId: "knight",
      enemyId: "stone-titan",
      deck: [],
      loadoutMode: "bare",
      maxTurns: 1,
      iterations: 3,
      seed: 1,
    });
    expect(batch.averageEnemyAttacks).toBe(1);
    expect(batch.averageEnemyAbilityUses).toBe(1);
    expect(batch.averageEnemyAbilityActivations).toBe(2 / 3);
    expect(batch.winsBeforeEnemyAttackRate).toBe(0);
    for (const result of batch.results) {
      expect(Object.values(result.enemyAbilityUses).reduce((sum, count) => sum + count, 0)).toBe(1);
      expect(result.enemyAbilityActivations).toEqual(result.enemyAbilityUses.sunder ? {} : { "stone-titan": 1 });
      expect(result.wonBeforeEnemyAttack).toBe(false);
    }
  });
});
