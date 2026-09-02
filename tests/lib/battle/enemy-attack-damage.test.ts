import { describe, expect, it } from "vitest";
import { applyEnemyLeechHealing, processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { makeTestBattleState } from "../../fixtures/battle";

describe("enemy attack damage", () => {
  it("resolves an undodgeable incoming packet and enemy leech", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      enemyHealth: 10,
      enemyMaxHealth: 20,
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(25);
    expect(applyEnemyLeechHealing(damaged, 5, []).enemyHealth).toBeGreaterThan(10);
  });

  it("block absorbs before health is lost", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 5, armor: 0 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(30);
    expect(damaged.playerStatuses.block).toBe(0);
  });

  it("armor absorbs then decays after damaging the player", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 3 },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, []);
    expect(damaged.playerHealth).toBe(28);
    expect(damaged.playerStatuses.armor).toBe(2);
  });

  it("fires health-threshold block when damage crosses the threshold", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { ...base.playerStatuses, block: 0, armor: 0 },
      talentEffects: { ...base.talentEffects, healthThresholdBlock: { threshold: 50, amount: 4 } },
    });
    const damaged = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 20 }, []);
    expect(damaged.playerHealth).toBe(10);
    expect(damaged.playerStatuses.block).toBe(4);
  });
});
