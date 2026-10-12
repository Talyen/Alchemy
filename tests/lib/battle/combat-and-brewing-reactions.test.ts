import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { createMixedPotion } from "@/lib/alchemist";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { patchBattleState } from "../../fixtures/battle";

describe("combat and brewing reactions", () => {
  it.each([true, false])(
    "Block-depletion retaliation settles before Saintfall (Death's Door used: %s)",
    (deathsDoorUsed) => {
      const state = patchBattleState({
        playerHealth: 1,
        deathsDoorUsed,
        playerStatuses: { block: 1 },
        enemyHealth: 50,
        enemyMaxHealth: 50,
        currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
        gearEffects: { stunOnBlockDepleted: 2, saintfallRetribution: 4 },
        rng: () => 0.99,
      });
      const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 1 }, [], {
        canDodge: false,
      }).state;
      expect(result.playerHealth).toBe(deathsDoorUsed ? 0 : 5);
      expect(result.enemyHealth).toBe(deathsDoorUsed ? 48 : 44);
    },
  );

  it.each([true, false])("Smoke Screen settles before Clean Getaway (Death's Door used: %s)", (deathsDoorUsed) => {
    const state = patchBattleState({
      playerHealth: 1,
      deathsDoorUsed,
      playerStatuses: { poison: 1 },
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { burn: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      flags: { dodgeNextAttack: true },
      talentEffects: { burnOnDodgeBurning: 2, cleanseStacksOnDodge: 1 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 6 },
      rng: () => 0.99,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    }).state;
    expect(result.playerHealth).toBe(deathsDoorUsed ? 0 : 7);
    expect(result.playerStatuses.poison).toBe(deathsDoorUsed ? 1 : 0);
  });
  it.each([1, 10])("Riposting settles before Fleeting (Health: %s)", (playerHealth) => {
    const state = patchBattleState({
      playerHealth,
      deathsDoorUsed: true,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyStatuses: { bleed: 1 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      flags: { dodgeNextAttack: true },
      gearEffects: { physicalOnDodge: 2, bleedOnDodge: 3 },
      rng: () => 0,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 4 }, [], {
      canDodge: true,
    }).state;
    expect(result.playerHealth).toBe(playerHealth - 1);
    expect(result.enemyStatuses.bleed).toBe(playerHealth === 1 ? 1 : 7);
  });

  it("mixing two Acid Potions preserves both Armor-halving effects", () => {
    const acid = cardById["acid-potion"]!;
    const mixed = createMixedPotion(acid, acid);
    const state = patchBattleState({ enemyMitigation: { armor: 8 }, rng: () => 0.99 });
    const separate = applyCardEffects(applyCardEffects(state, acid, []), acid, []);
    expect(separate.enemyMitigation.armor).toBe(1);
    expect(applyCardEffects(state, mixed, []).enemyMitigation.armor).toBe(separate.enemyMitigation.armor);
  });
});
