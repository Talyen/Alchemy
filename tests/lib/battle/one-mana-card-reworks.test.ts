import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { describe, expect, it } from "vitest";
import { cardById, cardLibrary, computeTalentEffects } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyWishEffect, buildWishOptions } from "@/lib/battle/wish";
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
    expect(next.playerStatuses.forge).toBe(3);
    expect(next.hand).toHaveLength(1);
    expect(next.wishOptions).not.toBeNull();
    expect(next.wishQueue).toHaveLength(1);
  });

  it("Stargaze resolves its Wish immediately without scheduling a turn-start effect", () => {
    const initial = battle({
      talentEffects: computeTalentEffects({ wish: ["wish-mana", "wish-health"], gold: ["gold-on-wish"] }),
    });
    const played = play(initial, "stargaze");
    expect(played.mana).toBe(3);
    expect(played.enemyHealth).toBe(199);
    expect(played.wishOptions).toHaveLength(3);
    expect(played.gold).toBe(0);
    expect(played.flags.pendingWishMana).toBe(0);
    expect(played.pendingTurnStartEffects).toHaveLength(0);
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
    const gear = applyWishEffect(
      battle({ gearEffects: { burnOnWish: 2 }, enemyStatuses: { burn: 1 } }),
      cardById.wish!,
      1,
      [],
    );
    expect(gear.enemyHealth).toBe(198);
    expect(gear.enemyStatuses.burn).toBe(1);
  });

  it("Stargaze does not add a Wish to the pending queue", () => {
    const played = play(battle(), "stargaze");
    expect(played.pendingTurnStartEffects).toHaveLength(0);
    expect(played.wishQueue).toHaveLength(0);
  });

  it("does not schedule Stargaze’s Wish after the enemy is defeated", () => {
    const killed = play(battle({ enemyHealth: 1 }), "stargaze");
    expect(killed.enemyHealth).toBe(0);
    const next = advanceToPlayerTurn(resume(killed));
    expect(killed.pendingTurnStartEffects).toHaveLength(0);
    expect(next.pendingTurnStartEffects).toHaveLength(0);
  });

  it("Bread restores Health immediately and does not queue future healing", () => {
    const eaten = play(battle(), "bread");
    expect(eaten.playerHealth).toBe(11);
    expect(eaten.exhausted).toContainEqual(expect.objectContaining({ id: "bread" }));
    const first = advanceToPlayerTurn(resume(eaten));
    expect(first.playerHealth).toBe(11);
    expect(first.pendingTurnStartEffects).toHaveLength(0);
    const second = advanceToPlayerTurn(first);
    expect(second.playerHealth).toBe(11);
    expect(second.pendingTurnStartEffects).toHaveLength(0);
  });

  it("Ray of Frost deals both Freeze hits immediately while Concussive Shot resolves one random-type hit", () => {
    const ray = play(battle(), "ray-of-frost");
    expect(ray.enemyHealth).toBe(198);
    expect(ray.enemyStatuses.freeze).toBe(2);
    expect(ray.pendingTurnStartEffects).toHaveLength(0);
    expect(advanceToPlayerTurn(ray).enemyHealth).toBe(198);
    const shot = play(battle(), "concussive-shot");
    expect(shot.enemyHealth).toBe(198);
    expect(shot.enemyStatuses.stun).toBe(0);
    const delayed = advanceToPlayerTurn(shot);
    expect(delayed.enemyHealth).toBe(198);
    expect(delayed.enemyStatuses.stun).toBe(0);
  });

  it("Powerful Wish upgrades repeated immediate effects and implicit single-card draws", () => {
    const options = buildWishOptions(
      battle({ talentEffects: { wishCardsUpgraded: true, wishExtraChoices: cardLibrary.length } }),
      cardById.wish!,
    );
    const ray = options.find((card) => card.id === "ray-of-frost")!;
    expect(ray.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "damage", damageType: "freeze", amount: 2 },
    ]);
    expect(ray.descriptionLines).toEqual(["Deal 2 Freeze damage twice"]);
    const bread = options.find((card) => card.id === "bread")!;
    expect(bread.effects).toEqual([{ kind: "heal", amount: 7 }]);
    const stargaze = options.find((card) => card.id === "stargaze")!;
    expect(stargaze.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "wish", amount: 2 },
    ]);
    const berries = options.find((card) => card.id === "mana-berries")!;
    expect(berries.descriptionLines).toContain("Draw 2 cards");
    for (const card of [ray, bread, stargaze, berries]) expect(validateCardDescriptionParity(card)).toEqual([]);
    expect(cardById.bread!.effects[0]).toMatchObject({ amount: 6 });
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
    const modified = applyNumericCorruption(card, getEditableCorruptionTargets(card)[0]!, 2);
    const saved = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(modified))));
    expect(saved.effects).toEqual(modified.effects);
    expect(saved.descriptionLines).toEqual(modified.descriptionLines);
    expect(saved.corrupted).toBe(true);
  });
});
