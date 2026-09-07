import { describe, expect, it } from "vitest";
import { applyAttackPurgeRider } from "@/lib/battle/damage-riders";
import { paceCombatMagnitude } from "@/lib/battle/fight-pacing";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("damage rider regressions", () => {
  it("activates Divine Aegis when Wardbreaker crosses half Health", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [ENCOUNTER_TRAITS["divine-aegis"].enemyTrait] },
      enemyMitigation: { armor: 1 },
      gearEffects: { attackPurgeDealHolyPerEffect: 1 },
    });
    const result = applyAttackPurgeRider(state, []);
    expect(result.enemyHealth).toBe(5);
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation).toMatchObject({ armor: 2, block: 4 });
    expect(state.flags.divineAegisTriggered).toBe(false);
  });

  it("scales Wardbreaker damage with fight pacing", () => {
    const state = patchBattleState({
      appliesFightPacing: true,
      turn: 40,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 1 },
      gearEffects: { attackPurgeDealHolyPerEffect: 10 },
    });
    const expectedDamage = paceCombatMagnitude(state, 10, "player");
    expect(expectedDamage).toBeGreaterThan(10);
    expect(applyAttackPurgeRider(state, []).enemyHealth).toBe(100 - expectedDamage);
  });

  it("does not trigger Obsidian Hammer when Block absorbs all Physical damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerStatuses: { forge: 4 },
      enemyMitigation: { block: 9 },
      trinketEffects: { forgeStunThreshold: 4, forgeStunAmount: 1 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const result = dealDamage(state, card);
    expect(result.enemyMitigation.block).toBe(0);
    expect(result.enemyHealth).toBe(state.enemyHealth);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.playerStatuses.forge).toBe(4);
  });
});
