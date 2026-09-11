import { describe, expect, it } from "vitest";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { repeatUniqueCardDamage } from "@/lib/battle/unique-card-effects";
import { applyHealingWithCombatText } from "@/lib/battle/combat-text";
import { companionLibrary } from "@/lib/game-data";

describe("combat reward sources", () => {
  it("Blood Debt increases healing from queued Bleed Leech", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 26,
      enemyStatuses: { bleed: 4 },
      pendingBleedLeechHealing: 4,
      talentEffects: { leechMissingHealthStep: 8 },
    });
    expect(tickEnemyStatuses(state, []).playerHealth).toBe(14);
  });

  it("Mana Siphon and Siphoning gear reward Poison Leech", () => {
    const state = patchBattleState({
      rng: () => 0,
      mana: 0,
      maxMana: 5,
      playerHealth: 10,
      enemyStatuses: { poison: 4 },
      talentEffects: { poisonLeechChance: 100, manaOnLeechChance: 100 },
      gearEffects: { manaOnLeechChance: 100 },
    });
    expect(tickEnemyStatuses(state, []).mana).toBe(2);
  });

  it("direct Leech grants each Mana reward once even at full Health", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      mana: 0,
      maxMana: 5,
      talentEffects: { manaOnLeechChance: 100 },
      gearEffects: { manaOnLeechChance: 100 },
    });
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 4, lifesteal: true }] });
    expect(dealDamage(state, card).mana).toBe(2);
  });

  it("Golden Crucible Forge triggers Overheat without scaling the Gold conversion", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerStatuses: { forge: 3 },
      talentEffects: { forgeBurnThreshold: 5, forgeBurnDamage: 2 },
      gearEffects: { goldGrantsForgeAndHoly: 1 },
    });
    const result = applyCardEffects(state, makeTestCard({ effects: [{ kind: "gain-gold", amount: 2 }] }), []);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyHealth).toBe(state.enemyHealth - 2);
    expect(result.enemyStatuses.burn).toBe(2);
  });

  it("Second Wind cannot cancel rewards for Companion damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 51,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
      activeCompanion: companionLibrary.bear,
      talentEffects: { companionDamage: 2, blockOnCompanionDamage: 2 },
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.flags.secondWindTriggered).toBe(true);
    expect(result.enemyHealth).toBeGreaterThan(state.enemyHealth);
    expect(result.playerStatuses.block).toBe(2);
    const blocked = processCompanionTurnStart(
      { ...state, enemyMitigation: { ...state.enemyMitigation, block: 100 } },
      [],
    );
    expect(blocked.playerStatuses.block).toBe(0);
  });
});

describe("combat healing regressions", () => {
  it.each(["tick", "hit"])("Poison Leech excludes overkill from a %s", (source) => {
    const state = patchBattleState({
      enemyHealth: 3,
      playerHealth: 10,
      enemyStatuses: { poison: 20 },
      talentEffects: { poisonLeechChance: 100 },
    });
    const result =
      source === "tick"
        ? tickEnemyStatuses(state, [])
        : dealDamage(
            { ...state, rng: () => 0.99 },
            makeTestCard({
              effects: [{ kind: "damage", damageType: "poison", amount: 20 }],
            }),
          );
    expect(result.playerHealth).toBe(12);
  });

  it("gear-repeated explicit card Leech triggers Clean Slate", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 29,
      playerMaxHealth: 30,
      playerStatuses: { poison: 3 },
      talentEffects: { cleanseOnCardOverheal: true, nextHolyFreeOnCleanse: true },
    });
    const card = makeTestCard({
      effects: [{ kind: "damage", damageType: "physical", amount: 6, lifesteal: true }],
    });
    const result = repeatUniqueCardDamage(state, card, []);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.flags.nextHolyCardFree).toBe(true);
  });

  it("Profane Blood triggers Second Wind on a surviving half-Health crossing", () => {
    const state = patchBattleState({
      enemyHealth: 51,
      enemyMaxHealth: 100,
      playerHealth: 10,
      currentEnemy: {
        traits: [
          { id: "blood-countess", title: "Profane Blood", description: "" },
          { id: "second-wind", title: "Second Wind", description: "" },
        ],
      },
    });
    const result = applyHealingWithCombatText(state, 1, []);
    expect(result.flags.secondWindTriggered).toBe(true);
    expect(result.enemyHealth).toBeGreaterThan(50);
    const repeated = applyHealingWithCombatText(result, 1, []);
    expect(repeated.enemyHealth).toBe(result.enemyHealth - 1);
  });
});
