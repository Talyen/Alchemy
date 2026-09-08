import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { describe, expect, it } from "vitest";
import { cardById, cardLibrary, computeTalentEffects } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyWishEffect, buildWishOptions, chooseWishCard } from "@/lib/battle/wish";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 200,
    enemyMaxHealth: 200,
    playerHealth: 5,
    playerMaxHealth: 40,
    mana: 3,
    maxMana: 3,
    rng: () => 0.99,
    ...patch,
  });
}

function play(state: ReturnType<typeof battle>, id: string) {
  const card = cardById[id]!;
  return playBattleCardResolved({ ...state, hand: [...state.hand, card] }, id, state.hand.length).state;
}

function resume(state: ReturnType<typeof battle>) {
  return { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state))), rng: () => 0.99 };
}

describe("one-Mana card tradeoffs", () => {
  it("Prayer costs one Mana, repeats its effects when doubled, and Consumes only once", () => {
    const initial = battle({
      talentEffects: computeTalentEffects({ consume: ["consume-last-supper", "consume-second-helping"] }),
      deck: [cardById.slash!, cardById.slash!],
      flags: { playNextCardTwice: true },
    });
    const next = play(initial, "prayer");
    expect(next.mana).toBe(2);
    expect(next.playerHealth).toBe(11);
    expect(next.exhausted.filter((card) => card.id === "prayer")).toHaveLength(1);
    expect(next.playerStatuses.forge).toBe(1);
    expect(next.hand).toHaveLength(1);
    expect(next.wishOptions).not.toBeNull();
    expect(next.wishQueue).toHaveLength(1);
  });

  it("Stargaze schedules its Wish and rewards for the next turn, including after saving", () => {
    const initial = battle({
      talentEffects: computeTalentEffects({ wish: ["wish-mana", "wish-health"], gold: ["gold-on-wish"] }),
    });
    const played = play(initial, "stargaze");
    expect(played.mana).toBe(2);
    expect(played.enemyHealth).toBe(198);
    expect(played.wishOptions).toBeNull();
    expect(played.gold).toBe(0);
    expect(played.flags.pendingWishMana).toBe(0);
    const next = advanceToPlayerTurn(resume(played));
    expect(next.wishOptions).toHaveLength(3);
    expect(next.gold).toBe(3);
    expect(next.playerHealth).toBe(7);
    expect(next.flags.pendingWishMana).toBe(1);
    expect(next.cardsPlayedThisTurn).toBe(0);
    expect(next.pendingTurnStartEffects).toHaveLength(0);
    const chosen = chooseWishCard(next, next.wishOptions![0]!.id);
    expect(chosen.gold).toBe(3);
    expect(chosen.flags.pendingWishMana).toBe(1);
  });

  it("Burning Wish creates normal Burn buildup without changing Gear-only Wish pulses", () => {
    const initial = battle({
      talentEffects: { burnOnWish: 2 },
      enemyMitigation: { armor: 3 },
      flags: { nextHitCrit: true },
    });
    const burned = applyWishEffect(initial, cardById.wish!, 1, []);
    expect(burned.enemyHealth).toBe(198);
    expect(burned.enemyStatuses.burn).toBe(2);
    expect(burned.enemyMitigation.armor).toBe(2);
    expect(burned.flags.nextHitCrit).toBe(true);
    const gear = applyWishEffect(battle({ gearEffects: { burnOnWish: 2 } }), cardById.wish!, 1, []);
    expect(gear.enemyHealth).toBe(198);
    expect(gear.enemyStatuses.burn).toBe(0);
  });

  it("two Stargazes queue two Wishes without duplicating the pending effects on resume", () => {
    const twice = play(play(battle(), "stargaze"), "stargaze");
    const due = advanceToPlayerTurn(resume(twice));
    expect(due.wishOptions).not.toBeNull();
    expect(due.wishQueue).toHaveLength(1);
    expect(due.pendingTurnStartEffects).toHaveLength(0);
    const nextWish = chooseWishCard(due, due.wishOptions![0]!.id);
    expect(nextWish.wishOptions).not.toBeNull();
    expect(nextWish.wishQueue).toHaveLength(0);
  });

  it("does not resolve Stargaze’s Wish after the enemy is defeated", () => {
    const killed = play(battle({ enemyHealth: 1 }), "stargaze");
    expect(killed.enemyHealth).toBe(0);
    const next = advanceToPlayerTurn(resume(killed));
    expect(next.wishOptions).toBeNull();
    expect(battle().pendingTurnStartEffects).toHaveLength(0);
  });

  it("Bread trades immediate healing for two future healing pulses", () => {
    const eaten = play(battle(), "bread");
    expect(eaten.playerHealth).toBe(9);
    expect(eaten.exhausted).toContainEqual(expect.objectContaining({ id: "bread" }));
    const first = advanceToPlayerTurn(resume(eaten));
    expect(first.playerHealth).toBe(13);
    expect(first.pendingTurnStartEffects).toHaveLength(1);
    const second = advanceToPlayerTurn(first);
    expect(second.playerHealth).toBe(17);
    expect(second.pendingTurnStartEffects).toHaveLength(0);
  });

  it("Ray of Frost and Concussive Shot retain different immediate and delayed hits", () => {
    const ray = play(battle(), "ray-of-frost");
    expect(ray.enemyHealth).toBe(199);
    expect(advanceToPlayerTurn(ray).enemyHealth).toBe(196);
    const shot = play(battle(), "concussive-shot");
    expect(shot.enemyStatuses.stun).toBe(2);
    const delayed = advanceToPlayerTurn(shot);
    expect(delayed.enemyHealth).toBe(196);
    expect(delayed.enemyStatuses.stun).toBe(2);
  });

  it("Powerful Wish upgrades separately described delayed effects and implicit single-card draws", () => {
    const options = buildWishOptions(
      battle({ talentEffects: { wishCardsUpgraded: true, wishExtraChoices: cardLibrary.length } }),
      cardById.wish!,
    );
    const ray = options.find((card) => card.id === "ray-of-frost")!;
    expect(ray.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "repeat-over-turns", remainingTurns: 1, effects: [{ kind: "damage", damageType: "freeze", amount: 4 }] },
    ]);
    const bread = options.find((card) => card.id === "bread")!;
    expect(bread.effects).toEqual([
      { kind: "heal", amount: 5 },
      { kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 5 }] },
    ]);
    const stargaze = options.find((card) => card.id === "stargaze")!;
    expect(stargaze.effects[1]).toMatchObject({ remainingTurns: 1, effects: [{ kind: "wish", amount: 2 }] });
    const berries = options.find((card) => card.id === "mana-berries")!;
    expect(berries.descriptionLines).toContain("Draw 2 cards");
    for (const card of [ray, bread, stargaze, berries]) expect(validateCardDescriptionParity(card)).toEqual([]);
    expect(cardById.bread!.effects[0]).toMatchObject({ amount: 4 });
  });

  it.each(["ray-of-frost", "bread", "stargaze", "mana-berries"])(
    "corruption keeps %s descriptions paired with its own effect amounts",
    (id) => {
      const card = cardById[id]!;
      for (const target of getEditableCorruptionTargets(card)) {
        const next = applyNumericCorruption(card, target, 1);
        expect(next).not.toBe(card);
        expect(validateCardDescriptionParity(next)).toEqual([]);
        expect(next.cost).toBe(1);
      }
    },
  );

  it("preserves valid legacy Prayer and modified Ray of Frost content as complete saved units", () => {
    const oldPrayer = {
      ...cardById.prayer!,
      consume: false,
      descriptionLines: ["Wish 1", "Restore 3 Health"],
      uid: 42,
    };
    const restored = hydrateCard(BattleCardSchema.parse(oldPrayer));
    expect(restored.consume).toBe(false);
    expect(restored.uid).toBe(42);
    expect(restored.descriptionLines).toEqual(oldPrayer.descriptionLines);
    const card = cardById["ray-of-frost"]!;
    const modified = applyNumericCorruption(card, getEditableCorruptionTargets(card)[1]!, 2);
    const saved = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(modified))));
    expect(saved.effects).toEqual(modified.effects);
    expect(saved.descriptionLines).toEqual(modified.descriptionLines);
    expect(saved.corrupted).toBe(true);
  });
});
