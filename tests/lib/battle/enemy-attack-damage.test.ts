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
});
