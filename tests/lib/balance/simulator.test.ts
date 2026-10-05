import { makeTestCard } from "../../fixtures/battle";
import { describe, expect, it } from "vitest";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { simulateBatch, simulateBattle } from "@/lib/balance";

describe("balance simulator", () => {
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
});

describe("enemy interaction measurements", () => {
  it("counts an opening Companion's Cinder Skin reaction before a first-turn kill", () => {
    const result = simulateBattle({
      characterId: "knight",
      enemyId: "fire-elemental",
      loadoutMode: "bare",
      seed: 24,
      deck: [makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 10000 }] })],
      difficultyModifiers: [{ kind: "start-companion", companionId: "skeleton" }],
    });
    expect(result).toMatchObject({ outcome: "win", wonBeforeEnemyAttack: true, enemyAttackActions: 0 });
    expect(result.enemyAbilityActivations).toEqual({ "cinder-skin": 1 });
    expect(result.enemyAbilityUses).toEqual({});
  });
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
    const activations = batch.results.filter((result) => !result.enemyAbilityUses.sunder).length;
    expect(batch.averageEnemyAbilityActivations).toBe(activations / batch.iterations);
    expect(batch.winsBeforeEnemyAttackRate).toBe(0);
    for (const result of batch.results) {
      expect(Object.values(result.enemyAbilityUses).reduce((sum, count) => sum + count, 0)).toBe(1);
      expect(result.enemyAbilityActivations).toEqual(result.enemyAbilityUses.sunder ? {} : { "stone-titan": 1 });
      expect(result.wonBeforeEnemyAttack).toBe(false);
    }
  });

  it("bypasses anomaly tracking when trackAnomalies is false", () => {
    const config = {
      characterId: "knight" as const,
      enemyId: "skeleton",
      seed: 42,
      maxTurns: 10,
      trackAnomalies: false,
    };
    const withTracking = simulateBattle({ ...config, trackAnomalies: true });
    const withoutTracking = simulateBattle(config);

    const { anomalies: trackedAnomalies, ...trackedBattle } = withTracking;
    const { anomalies: emptyAnomalies, ...untrackedBattle } = withoutTracking;
    expect(untrackedBattle).toEqual(trackedBattle);
    expect(Object.isFrozen(emptyAnomalies)).toBe(true);
    // When trackAnomalies is false, returned anomalies is the frozen empty sentinel
    expect(withoutTracking.anomalies.maxSingleHitDamageToEnemy).toBe(0);
    expect(trackedAnomalies.maxSingleHitDamageToEnemy).toBeGreaterThan(0);
  });

  it("adds talent and gear bonuses on top of an explicit playerMaxHealth base", () => {
    const base = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 7,
      maxTurns: 1,
      loadoutMode: "typical",
      talentPreset: "late",
    });
    const explicit = simulateBattle({
      characterId: "knight",
      enemyId: "skeleton",
      seed: 7,
      maxTurns: 1,
      loadoutMode: "typical",
      talentPreset: "late",
      playerMaxHealth: 40,
    });
    expect(explicit.playerMaxHealth).toBeGreaterThan(40);
    expect(explicit.playerMaxHealth - 40).toBe(base.playerMaxHealth - MAX_PLAYER_HEALTH);
  });
});
