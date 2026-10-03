import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { tickEnemyPoison } from "@/lib/battle/status-ticks";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyEmergencyWishForEmptyDraw } from "@/lib/battle/wish";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import type { CombatTextEvent } from "@/lib/battle/types";
import { cardById } from "@/lib/game-data";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("draw and status interaction regressions", () => {
  it("Mana Berries offers an Emergency Wish when its draw finds empty piles", () => {
    const card = cardById["mana-berries"]!;
    const state = patchBattleState({ hand: [card], deck: [], discard: [], rng: () => 0.99 });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.wishOptions).toHaveLength(3);
    expect(result.state.exhausted).toContainEqual(card);
    expect(result.combatTexts.some((text) => text.stat === "draw")).toBe(false);
  });

  it("does not report a random draw when empty piles trigger an Emergency Wish", () => {
    const card = makeTestCard({ effects: [{ kind: "random-draw", minAmount: 1, maxAmount: 2 }] });
    const state = patchBattleState({ hand: [card], deck: [], discard: [], rng: () => 0.99 });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.wishOptions).toHaveLength(3);
    expect(result.combatTexts.some((text) => text.stat === "draw")).toBe(false);
  });

  it("Runic Quill offers an Emergency Wish after the last Health Potion is consumed", () => {
    const card = cardById["health-potion"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [],
      discard: [],
      trinketEffects: { runicQuillDrawOnConsume: 1 },
      talentEffects: { uncappedDrawOnConsume: 1 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.wishOptions).toHaveLength(3);
    expect(next.wishQueue).toEqual([]);
  });

  it("does not open an Emergency Wish for zero draws or a completed battle", () => {
    const empty = patchBattleState({ hand: [], deck: [], discard: [] });
    expect(applyEmergencyWishForEmptyDraw(empty, 0, [])).toBe(empty);
    const won = { ...empty, enemyHealth: 0 };
    expect(applyEmergencyWishForEmptyDraw(won, 1, [])).toBe(won);
  });

  it("settles fatal Emergency Wish retaliation before later Consume rewards", () => {
    const card = cardById["mana-crystals"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [],
      discard: [],
      playerHealth: 1,
      deathsDoorUsed: true,
      currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      trinketEffects: { runicQuillDrawOnConsume: 1 },
      talentEffects: { burnOnWish: 1 },
      gearEffects: { armorOnConsume: 2 },
      rng: () => 0.99,
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.playerHealth).toBe(0);
    expect(next.playerStatuses.armor).toBe(0);
    expect(next.exhausted).toContainEqual(card);
  });

  it.each(["poisonedAttacksPierce", "armorIncreasesStun"] as const)(
    "Sundering Charm still removes Armor alongside %s",
    (signature) => {
      const effect = { kind: "damage", damageType: "stun", amount: 4 } as const;
      const card = makeTestCard({ effects: [effect] });
      const state = patchBattleState({
        enemyMitigation: { armor: 8 },
        enemyStatuses: { poison: 1 },
        gearEffects: { [signature]: 1 },
        trinketEffects: { sunderingArmorPiercing: 2 },
        rng: () => 0.99,
      });
      const hit = computeCardDamageToEnemy(state, effect, card);
      expect(hit.nextState.enemyMitigation.armor).toBe(6);
      expect(hit.modifiedDamage).toBe(signature === "armorIncreasesStun" ? 12 : 4);
    },
  );

  it("Plague Doctor's Mask reports a full Poison cleanse without losing its healing reward", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      deck: [cardById["block"]!],
      playerStatuses: { poison: 2 },
      trinketEffects: { plagueDoctorPoisonCleanse: 2, sinEaterHealOnHarmfulStatusRemove: 6 },
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const next = advanceToPlayerTurn(state, texts);
    expect(next.playerStatuses.poison).toBe(0);
    expect(next.playerHealth).toBe(16);
    expect(texts).toContainEqual(expect.objectContaining({ target: "player", stat: "poison", signal: "cleanse" }));
  });

  it.each(["burn", "bleed"] as const)("Bloodfire Signet reports the stacks mirrored from %s", (type) => {
    const state = patchBattleState({ gearEffects: { burnBleedMirrorAndLeech: 1 }, rng: () => 0 });
    const texts: CombatTextEvent[] = [];
    const next = applyDamageStatuses(state, { kind: "damage", damageType: type, amount: 3 }, 3, texts);
    const mirrored = type === "burn" ? "bleed" : "burn";
    expect(next.enemyStatuses[mirrored]).toBe(3);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat: mirrored, amount: 3 }));
  });

  it.each(["tick", "detonation"] as const)(
    "Caustic reports only the Armor actually removed by a Poison %s",
    (source) => {
      const state = patchBattleState({
        enemyHealth: 100,
        enemyMaxHealth: 100,
        enemyMitigation: { armor: 2 },
        enemyStatuses: { poison: 5 },
        talentEffects: { poisonStripArmorByDamage: true },
        rng: () => 0.99,
      });
      const texts: CombatTextEvent[] = [];
      const next = source === "tick" ? tickEnemyPoison(state, texts) : detonateEnemyStatuses(state, ["poison"], texts);
      expect(next.enemyMitigation.armor).toBe(0);
      expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "armor", amount: 2, impact: false });
    },
  );
});
