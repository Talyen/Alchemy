import { describe, expect, it, vi } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { applyAttackPurgeRider } from "@/lib/battle/damage-riders";
import { applyBrassCenser, dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import type { CombatTextEvent } from "@/lib/battle/types";
import { dealDamage, makeTestCard, patchBattleState } from "../../fixtures/battle";

function rolls(...values: number[]) {
  const rng = vi.fn(() => 0.99);
  for (const value of values) rng.mockReturnValueOnce(value);
  return rng;
}

function holyCard(amount = 6) {
  return makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount }] });
}

describe("Plague Doctor's Mask", () => {
  it.each([
    [0, 0, 0],
    [1, 0, 1],
    [2, 0, 1],
    [5, 3, 1],
  ])("cleanses %i Poison to %i and deals %i damage", (poison, remaining, damage) => {
    const state = patchBattleState({
      rng: rolls(),
      playerHealth: 10,
      playerStatuses: { poison, burn: 3, bleed: 4 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2, sinEaterHealOnHarmfulStatusRemove: 6 },
      talentEffects: { healOnStatusCleanse: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const result = advanceToPlayerTurn(state, texts);
    expect(result.playerStatuses).toMatchObject({ poison: remaining, burn: 3, bleed: 4 });
    expect(result.enemyHealth).toBe(state.enemyHealth - damage);
    expect(result.enemyStatuses.poison).toBe(damage);
    expect(result.playerHealth).toBe(poison > 0 ? 18 : 10);
    expect(state.playerStatuses.poison).toBe(poison);
    if (damage > 0) expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: damage });
  });

  it("does nothing without the Mask", () => {
    const state = patchBattleState({ rng: rolls(), playerStatuses: { poison: 5 } });
    const result = advanceToPlayerTurn(state);
    expect(result.playerStatuses.poison).toBe(5);
    expect(result.enemyHealth).toBe(state.enemyHealth);
  });

  it("cleanses and retaliates on consecutive Haste turns", () => {
    const state = patchBattleState({
      rng: rolls(),
      playerStatuses: { poison: 5, haste: 2 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2 },
    });
    const first = endPlayerTurn(state);
    const second = endPlayerTurn(first.state);
    expect(first.kind).toBe("haste");
    expect(second.kind).toBe("haste");
    expect(second.state.playerStatuses.poison).toBe(1);
    expect(second.state.playerHealth).toBe(state.playerHealth);
    expect(second.state.enemyHealth).toBe(state.enemyHealth - 2);
    expect(second.state.enemyStatuses.poison).toBe(2);
  });

  it("treats Poison after the enemy phase's tick", () => {
    const state = patchBattleState({
      rng: rolls(),
      enemyAttackEffects: [],
      playerStatuses: { poison: 5 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2 },
    });
    const result = endPlayerTurn(state).state;
    expect(result.playerHealth).toBe(state.playerHealth - 5);
    expect(result.playerStatuses.poison).toBe(2);
    expect(result.enemyStatuses.poison).toBe(1);
  });

  it("resolves a retaliation kill before companions and pays rewards once", () => {
    const state = patchBattleState({
      rng: rolls(),
      playerHealth: 10,
      enemyHealth: 1,
      playerStatuses: { poison: 2 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2, boneCharmHealOnKill: 3 },
      activeCompanion: {
        id: "wolf",
        title: "Test",
        art: "",
        turnStartEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      },
    });
    const result = processCompanionTurnStart(advanceToPlayerTurn(state), []);
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(13);
  });

  it("uses Poison modifiers and mitigation", () => {
    const state = patchBattleState({
      rng: rolls(),
      playerStatuses: { poison: 2 },
      enemyMitigation: { block: 1 },
      gearEffects: { flatPoisonDamage: 3 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2 },
    });
    const result = advanceToPlayerTurn(state);
    expect(result.enemyHealth).toBe(state.enemyHealth - 3);
    expect(result.enemyStatuses.poison).toBe(3);
  });

  it.each(["playerHealth", "enemyHealth"] as const)("does not treat Poison after %s reaches zero", (field) => {
    const state = patchBattleState({
      rng: rolls(),
      [field]: 0,
      playerStatuses: { poison: 2 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2, sinEaterHealOnHarmfulStatusRemove: 6 },
    });
    const result = advanceToPlayerTurn(state);
    expect(result.playerStatuses.poison).toBe(2);
  });
});

describe("Brass Censer", () => {
  it.each([0.2, 0.99])("does not proc at or above the 20%% boundary (%f)", (roll) => {
    const rng = rolls(0.99, 0.99, roll);
    const state = patchBattleState({ rng, playerHealth: 10, trinketEffects: { brassCenserProcChance: 20 } });
    const result = dealDamage(state, holyCard());
    expect(result.enemyHealth).toBe(state.enemyHealth - 6);
    expect(result.enemyStatuses.burn).toBe(0);
    expect(result.playerHealth).toBe(10);
    expect(rng).toHaveBeenCalledTimes(3);
  });

  it("deals equal Burn damage and leaves Burn to tick, without Leech", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.19, 0.49),
      playerHealth: 10,
      trinketEffects: { brassCenserProcChance: 20 },
    });
    const result = dealDamage(state, holyCard());
    expect(result.enemyHealth).toBe(state.enemyHealth - 12);
    expect(result.enemyStatuses.burn).toBe(6);
    expect(result.playerHealth).toBe(10);
    const ticked = tickEnemyStatuses(result, []);
    expect(ticked.enemyHealth).toBe(result.enemyHealth - 6);
    expect(ticked.enemyStatuses.burn).toBe(3);
  });

  it("Leeches half the Holy damage, rounded, without repeating the hit or adding Burn", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.1, 0.5),
      playerHealth: 10,
      trinketEffects: { brassCenserProcChance: 20 },
    });
    const result = dealDamage(state, holyCard(5));
    expect(result.enemyHealth).toBe(state.enemyHealth - 5);
    expect(result.playerHealth).toBe(13);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("uses Leech modifiers and riders", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.1, 0.9),
      playerHealth: 10,
      trinketEffects: { brassCenserProcChance: 20 },
      talentEffects: { firstLeechCardDoubled: true, leechPoisonChance: 100 },
    });
    const result = dealDamage(state, holyCard());
    expect(result.playerHealth).toBe(16);
    expect(result.flags.firstLeechCardDoubledUsed).toBe(true);
    expect(result.enemyStatuses.poison).toBe(6);
  });

  it("uses Holy damage after Block and applies Burn modifiers separately", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.1, 0.1),
      enemyMitigation: { block: 2, armor: 5 },
      trinketEffects: { brassCenserProcChance: 20 },
      gearEffects: { flatBurnDamage: 2 },
    });
    const result = dealDamage(state, holyCard());
    expect(result.enemyHealth).toBe(state.enemyHealth - 10);
    expect(result.enemyStatuses.burn).toBe(6);
  });

  it("does not roll on dodged or fully blocked hits", () => {
    for (const dodge of [true, false]) {
      const rng = rolls(...(dodge ? [0.01] : [0.99, 0.99]));
      const state = patchBattleState({
        rng,
        enemyMitigation: { block: 20 },
        trinketEffects: { brassCenserProcChance: 20 },
      });
      const result = dealDamage(state, holyCard());
      expect(result.enemyHealth).toBe(state.enemyHealth);
      expect(result.enemyStatuses.burn).toBe(0);
      expect(rng).toHaveBeenCalledTimes(dodge ? 1 : 2);
    }
  });

  it("rolls independently for multiple Holy hits and subsequent cards", () => {
    const rng = rolls(0.99, 0.99, 0.1, 0.9, 0.99, 0.99, 0.1, 0.9, 0.99, 0.99, 0.1, 0.9);
    const state = patchBattleState({ rng, playerHealth: 10, trinketEffects: { brassCenserProcChance: 20 } });
    const card = makeTestCard({ effects: [holyCard(2).effects[0], holyCard(2).effects[0]] });
    const first = applyCardEffects(state, card, []);
    const second = dealDamage(first, holyCard(2));
    expect(second.enemyHealth).toBe(state.enemyHealth - 6);
    expect(second.playerHealth).toBe(13);
    expect(rng).toHaveBeenCalledTimes(12);
  });

  it("coexists with Holy Burn and healing talents", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.1, 0.1),
      playerHealth: 10,
      trinketEffects: { brassCenserProcChance: 20 },
      talentEffects: { holyBurnChance: 100, holyLifestealPercent: 10 },
    });
    const result = dealDamage(state, holyCard(10));
    expect(result.playerHealth).toBe(11);
    expect(result.enemyStatuses.burn).toBe(20);
  });

  it.each([4, 8])("pays kill rewards once when Holy or bonus Burn kills %i Health", (enemyHealth) => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.99, 0.1, 0.1),
      playerHealth: 10,
      enemyHealth,
      trinketEffects: { brassCenserProcChance: 20, boneCharmHealOnKill: 3 },
    });
    const result = dealDamage(state, holyCard());
    expect(result.enemyHealth).toBe(0);
    expect(result.playerHealth).toBe(13);
  });

  it("also triggers on Holy retaliation damage", () => {
    const state = patchBattleState({
      rng: rolls(0.99, 0.1, 0.1),
      trinketEffects: { brassCenserProcChance: 20 },
    });
    const result = dealPlayerTypedHit(state, "holy", 6, []);
    expect(result.enemyHealth).toBe(state.enemyHealth - 12);
    expect(result.enemyStatuses.burn).toBe(6);
  });

  it("also triggers on Holy damage from purging enemy defenses", () => {
    const state = patchBattleState({
      rng: rolls(0.1, 0.1),
      trinketEffects: { brassCenserProcChance: 20 },
      enemyMitigation: { armor: 3 },
      gearEffects: { attackPurgeDealHolyPerEffect: 4 },
    });
    const result = applyAttackPurgeRider(state, []);
    expect(result.enemyHealth).toBe(state.enemyHealth - 8);
    expect(result.enemyStatuses.burn).toBe(4);
  });

  it("does not roll without the Censer", () => {
    const rng = rolls();
    const state = patchBattleState({ rng });
    expect(applyBrassCenser(state, 6, [])).toBe(state);
    expect(rng).not.toHaveBeenCalled();
  });
});
