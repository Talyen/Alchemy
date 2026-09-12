import { describe, expect, it } from "vitest";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("Gear damage bonuses", () => {
  it.each(["burn", "bleed"] as const)("Pyric grants its percentage per Mana Crystal to %s", (damageType) => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      maxMana: 3,
      gearEffects: { burnDamagePerManaPercent: 20, sharedBurnBleedBonuses: damageType === "bleed" ? 1 : 0 },
    });
    const result = dealDamage(state, makeTestCard({ effects: [{ kind: "damage", damageType, amount: 10 }] }));
    expect(result.enemyHealth).toBe(84);
  });

  it.each([0, 1])("Bloodember shares First Blood with Burn (existing Bleed: %s)", (bleed) => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { bleed },
      gearEffects: { sharedBurnBleedBonuses: 1 },
      talentEffects: { bleedUnwoundedBonusPercent: 50 },
    });
    const result = dealDamage(state, makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] }));
    expect(result.enemyHealth).toBe(bleed === 0 ? 85 : 90);
  });
});
