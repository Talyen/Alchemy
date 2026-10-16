import { describe, expect, it } from "vitest";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { applyEmergencyWishForEmptyDraw } from "@/lib/battle/wish";
import { regressionBattle } from "../../fixtures/battle";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";

describe("reentrant combat rewards", () => {
  it("keeps Burn applied by an empty-draw Wish while detonating Bleed and Burn", () => {
    const state = regressionBattle({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed: 2, burn: 4 },
      talentEffects: { drawOnBleedDamageChance: 100, burnOnWish: 3 },
      onEmptyDraw: applyEmergencyWishForEmptyDraw,
    });
    const next = detonateEnemyStatuses(state, ["bleed", "burn"], []);
    expect(next.wishOptions?.length).toBeGreaterThan(0);
    expect(next.enemyStatuses.burn).toBe(3);
    expect(next.enemyHealth).toBe(91);
  });

  it("does not decay Armor granted by a Poison tick's follow-up hit", () => {
    const state = regressionBattle({
      enemyHealth: 12,
      enemyMaxHealth: 20,
      enemyStatuses: { poison: 1 },
      currentEnemy: { traits: [{ id: "divine-aegis", title: "Divine Aegis", description: "" }] },
      talentEffects: { poisonStunChance: 100 },
    });
    const next = tickEnemyStatuses(state, []);
    expect(next.enemyHealth).toBe(10);
    expect(next.flags.divineAegisTriggered).toBe(true);
    expect(next.enemyMitigation.armor).toBe(2);
  });
});
