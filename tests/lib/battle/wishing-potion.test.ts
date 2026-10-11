import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { isPotionCard } from "@/lib/game-data/cards/card-pools";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { chooseWishCard } from "@/lib/battle/wish";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion } from "@/lib/alchemist";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { patchBattleState } from "../../fixtures/battle";

describe("Wishing Potion supplies", () => {
  it("Wishes twice from the ordinary pool, rewards both Wishes, and resumes choices and full-hand delivery without drawing", () => {
    const potion = cardById["wishing-potion"]!;
    const slash = cardById.slash!;
    const initial = patchBattleState({
      hand: [potion, ...Array.from({ length: 6 }, () => slash)],
      deck: [slash],
      discard: [],
      exhausted: [],
      pendingHandCards: [],
      mana: 3,
      playerHealth: 20,
      playerMaxHealth: 30,
      talentEffects: { healthOnWish: 1, wishUndiscoveredCards: true },
      discoveredCardIds: ["health-potion"],
      rng: () => 0.4,
    });
    const played = playBattleCardResolved(initial, potion.id, 0).state;
    expect(played.mana).toBe(2);
    expect(played.playerHealth).toBe(22);
    expect(played.hand).toHaveLength(6);
    expect(played.deck).toEqual([slash]);
    expect(played.exhausted.map((card) => card.id)).toEqual([potion.id]);
    expect(played.wishQueue).toHaveLength(1);
    for (const options of [played.wishOptions!, ...played.wishQueue]) {
      expect(options).toHaveLength(3);
      expect(options.every((card) => card.id !== potion.id)).toBe(true);
      expect(options.some((card) => !isPotionCard(card))).toBe(true);
    }
    const first = chooseWishCard(played, played.wishOptions![0]!.id);
    const resumed = { ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(first))), rng: () => 0.4 };
    const offers = (cards: NonNullable<typeof first.wishOptions>) =>
      cards.map(({ id, effects, descriptionLines }) => ({ id, effects, descriptionLines }));
    expect(offers(resumed.wishOptions!)).toEqual(offers(first.wishOptions!));
    const chosen = resumed.wishOptions![0]!;
    const finished = chooseWishCard(resumed, chosen.id);
    expect(finished.wishOptions).toBeNull();
    expect(finished.wishQueue).toEqual([]);
    expect(finished.hand).toHaveLength(7);
    expect(offers(finished.pendingHandCards)).toEqual(offers([chosen]));
    expect(offers(finished.deck)).toEqual(offers([slash]));
  });

  it("keeps unrestricted Wishes and editable descriptions through distilling, mixing and saved-card hydration", () => {
    const potion = cardById["wishing-potion"]!;
    for (const [prepared, wishes] of [
      [strengthenPotion(potion)!, 3],
      [createMixedPotion(potion, potion), 4],
    ] as const) {
      const saved = BattleCardSchema.parse(JSON.parse(JSON.stringify(prepared)));
      const card = hydrateCard(saved)!;
      expect(card.effects).toContainEqual({ kind: "wish", amount: wishes });
      expect(card.descriptionLines).toContain(`Wish ${wishes}`);
      expect(validateCardDescriptionParity(card)).toEqual([]);
      const state = patchBattleState({ hand: [card], deck: [cardById.slash!], rng: () => 0.4 });
      const played = playBattleCardResolved(state, card.id, 0).state;
      const choices = [played.wishOptions!, ...played.wishQueue];
      expect(choices).toHaveLength(wishes);
      expect(choices.every((options) => options.length > 0 && options.some((card) => !isPotionCard(card)))).toBe(true);
    }
  });
});
