import { describe, expect, it } from "vitest";
import { cardById, companionLibrary } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const bloodCountess = { id: "blood-countess", title: "Blood Countess", description: "" };

describe("reward attribution regressions", () => {
  it("Piercing bypasses Armor without destroying it on a fully blocked hit", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 6, block: 20 },
      gearEffects: { armorPiercing: 2, archeryArmorPiercing: 1 },
      talentEffects: { archeryArmorPiercing: 1 },
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 10 };
    const card = makeTestCard({ tags: ["archery"], effects: [effect] });
    const blocked = computeCardDamageToEnemy(state, effect, card);
    expect(blocked.modifiedDamage).toBe(0);
    expect(blocked.nextState.enemyMitigation.armor).toBe(6);
    const unblocked = computeCardDamageToEnemy(
      { ...state, enemyMitigation: { ...state.enemyMitigation, block: 0 } },
      effect,
      card,
    );
    expect(unblocked.modifiedDamage).toBe(8);
    expect(unblocked.nextState.enemyMitigation.armor).toBe(6);
  });

  it("Feast does not award Block when kill rewards finish a Potion's healing", () => {
    const state = patchBattleState({
      playerHealth: 80,
      playerMaxHealth: 100,
      enemyHealth: 1,
      currentEnemy: { traits: [bloodCountess] },
      gearEffects: { healOnKill: 20 },
      talentEffects: { blockOnConsume: 4 },
    });
    const result = applyCardEffects(state, cardById["health-potion"]!, [], {
      origin: "played-card",
      manaAtStart: state.mana,
      enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
    });
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("Sanguine Overflow does not arm when kill rewards, rather than Leech, fill Health", () => {
    const state = patchBattleState({
      playerHealth: 80,
      playerMaxHealth: 100,
      enemyHealth: 1,
      currentEnemy: { traits: [bloodCountess] },
      gearEffects: { healOnKill: 20 },
      talentEffects: { nextAttackPhysicalOnLeechToFull: 2 },
    });
    const result = applyLeechHealing(state, 4, []);
    expect(result.playerHealth).toBe(100);
    expect(result.flags.sanguinePhysicalBonus).toBe(0);
  });

  it("Desperate Siphon grants Block only for Health restored by Leech", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 100,
      enemyHealth: 1,
      currentEnemy: { traits: [bloodCountess] },
      gearEffects: { healOnKill: 20 },
      talentEffects: { leechBlockBelowHalfPercent: 25 },
    });
    const result = applyLeechHealing(state, 4, []);
    expect(result.playerHealth).toBe(44);
    expect(result.playerStatuses.block).toBe(1);
  });

  it("Companion rewards stop when Thorns kills the hero", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { thorns: 10 },
      activeCompanion: companionLibrary.wolf,
      talentEffects: { blockOnCompanionDamage: 3, companionStunChance: 100 },
    });
    const result = processCompanionTurnStart(state, []);
    expect(result.playerHealth).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
    expect(result.enemyStatuses.stun).toBe(0);
  });
});
