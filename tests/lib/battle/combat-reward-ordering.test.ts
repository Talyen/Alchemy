import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat reward ordering", () => {
  it("Dodge Armor receives Reinforced and Last Stand and triggers Armored Surge", () => {
    const state = patchBattleState({
      rng: () => 0.01,
      playerHealth: 10,
      playerMaxHealth: 40,
      talentEffects: {
        armorOnDodge: 1,
        flatArmorAmount: 1,
        armorDoubledBelowHalfHealth: true,
        firstArmorCardDoubled: true,
        armorBlockThreshold: 4,
        armorBlockAmount: 8,
      },
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      [],
    );
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.block).toBe(8);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(false);
  });

  it.each([true, false])(
    "Faustian Bargain only grants Wishes if its Health cost is survived (Death's Door spent: %s)",
    (deathsDoorUsed) => {
      const card = cardById["faustian-bargain"]!;
      const state = patchBattleState({ hand: [card], playerHealth: 1, deathsDoorUsed });
      const result = playBattleCardResolved(state, card.id, 0).state;
      expect(result.playerHealth).toBe(deathsDoorUsed ? 0 : 1);
      expect(result.wishOptions !== null).toBe(!deathsDoorUsed);
      expect(result.exhausted).toContainEqual(card);
    },
  );

  it.each([0, 1])("fatal Cinder Skin stops later ticks and enemy abilities (Stun turns: %s)", (stunSkipTurns) => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 1,
      deathsDoorUsed: true,
      enemyHealth: 50,
      enemyMaxHealth: 50,
      enemyCC: { stunSkipTurns },
      enemyStatuses: { burn: 1, poison: 10, bleed: 10 },
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
    });
    const result = endPlayerTurn(state);
    expect(result.state.playerHealth).toBe(0);
    expect(result.state.enemyHealth).toBe(49);
    expect(result.state.enemyStatuses).toMatchObject({ poison: 10, bleed: 10 });
    expect(result.enemyPerformedAbility).toBe(false);
  });

  it.each(["tick", "detonate", "remaining"] as const)(
    "Septic Shock increases each Poison %s while the enemy is Bleeding",
    (mode) => {
      const state = patchBattleState({
        rng: () => 0.99,
        enemyHealth: 50,
        enemyMaxHealth: 50,
        enemyStatuses: { poison: 2, bleed: 1 },
        talentEffects: { bleedPoisonDamageTakenBonus: 1 },
      });
      const result =
        mode === "tick"
          ? tickEnemyStatuses(state, [])
          : detonateEnemyStatuses(state, ["poison"], [], mode === "remaining" ? "remaining-ticks" : "next-tick");
      expect(result.enemyHealth).toBe(50 - (mode === "tick" ? 4 : mode === "remaining" ? 5 : 3));
    },
  );

  it.each([
    { id: "ice-shot", enemyHealth: 3, gold: 2 },
    { id: "bounty-shot", enemyHealth: 3, gold: 4 },
    { id: "bounty-shot", enemyHealth: 1, gold: 4 },
  ])(
    "Trophy Shot pays once for $id defeating $enemyHealth Health, including secondary hits",
    ({ id, enemyHealth, gold }) => {
      const card = cardById[id]!;
      const state = patchBattleState({
        rng: () => 0.99,
        hand: [card],
        gold: 0,
        enemyHealth,
        enemyMaxHealth: 40,
        enemyCC: { freezeSkipTurns: id === "ice-shot" ? 1 : 0 },
        flags: { nextPhysicalDealsBleed: true, playNextCardTwice: true },
        talentEffects: { archeryHolyDamageVsFrozen: 2, goldOnArcheryKill: 2 },
      });
      const result = playBattleCardResolved(state, card.id, 0).state;
      expect(result.enemyHealth).toBe(0);
      expect(result.gold).toBe(gold + (id === "bounty-shot" ? 2 : 0));
    },
  );
});
