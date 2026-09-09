import { describe, expect, it } from "vitest";
import { applyAttackPurgeRider } from "@/lib/battle/damage-riders";
import { paceCombatDamage } from "@/lib/battle/fight-pacing";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { dealDamage, makeCombatTexts, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("damage rider regressions", () => {
  it("copies a resolved Physical hit once for Parting Cut and Stun even with large offensive bonuses", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      appliesFightPacing: true,
      turn: 26,
      currentEnemy: { enemyType: "boss", traits: [] },
      enemyHealth: 10000,
      enemyMaxHealth: 10000,
      playerStatuses: { forge: 7 },
      talentEffects: { physicalStunChance: 100, flatStunDamage: 50 },
      gearEffects: { flatBleedDamage: 50 },
      flags: { nextPhysicalDealsBleed: true, nextHitCrit: true },
    });
    const texts = makeCombatTexts();
    const result = dealDamage(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4 }] }),
      texts,
    );
    const damage = (stat: string) =>
      texts.reduce(
        (total, text) =>
          total + (text.kind === "damage" && text.target === "enemy" && text.stat === stat ? text.amount : 0),
        0,
      );
    expect(damage("physical")).toBeGreaterThan(20);
    expect(damage("stun")).toBe(damage("physical"));
    expect(damage("bleed")).toBe(damage("physical"));
    expect(result.enemyHealth).toBe(state.enemyHealth - damage("physical") * 3);
    expect(result.flags.nextPhysicalDealsBleed).toBe(false);
  });

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
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      enemyMitigation: { armor: 1 },
      gearEffects: { attackPurgeDealHolyPerEffect: 10 },
    });
    const expectedDamage = paceCombatDamage(state, 10, "player");
    expect(expectedDamage).toBeGreaterThan(10);
    expect(applyAttackPurgeRider(state, []).enemyHealth).toBe(state.enemyHealth - expectedDamage);
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
