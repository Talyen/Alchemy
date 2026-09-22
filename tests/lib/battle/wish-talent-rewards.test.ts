import { applyArmorReward } from "@/lib/battle/status-player";
import { buildWishOptions, chooseWishCard } from "@/lib/battle/wish";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { computeTalentEffects } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { describe, expect, it } from "vitest";
import { makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";

describe("Talent wish talent rewards", () => {
  const { talents, battle, attack, play } = talentBattle;

  it("guarantees the only undiscovered Wish card without changing offer size", () => {
    const pool = getOfferableCardPool();
    const missing = pool.find((card) => card.id !== "wish")!;
    const state = battle({
      talentEffects: talents("wish", "wish-undiscovered"),
      discoveredCardIds: pool.filter((card) => card.id !== missing.id).map((card) => card.id),
    });
    const options = buildWishOptions(state, makeTestCard({ id: "wish" }));
    expect(options).toHaveLength(3);
    expect(options.map((card) => card.id)).toContain(missing.id);
    expect(new Set(options.map((card) => card.id)).size).toBe(3);
    expect(
      buildWishOptions({ ...state, discoveredCardIds: pool.map((card) => card.id) }, makeTestCard({ id: "wish" })),
    ).toHaveLength(3);
  });

  it("grants a random declined card only for a valid selection, including full hands and queued Wishes", () => {
    const options = [attack("1"), attack("2"), attack("3"), attack("4")];
    const state = battle({
      talentEffects: { ...talents("wish", "wish-gold"), declinedWishCardChance: 100 },
      wishOptions: options,
      wishQueue: [options.slice(0, 2)],
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, i) => attack(`hand-${i}`)),
      rng: () => 0,
    });
    expect(chooseWishCard(state, "invalid")).toBe(state);
    const after = chooseWishCard(state, "1");
    expect(after.playerStatuses.block).toBe(0);
    expect(after.discard.slice(-2).map((card) => card.id)).toEqual(["1", "2"]);
    const final = chooseWishCard(after, "2");
    expect(final.playerStatuses.block).toBe(0);
    expect(chooseWishCard(final, "2")).toBe(final);
  });

  it("Wish selection cannot turn an absent reward into Block through Forge", () => {
    const options = [attack("1"), attack("2")];
    const state = battle({ playerStatuses: { forge: 5 }, talentEffects: { forgeToBlock: true }, wishOptions: options });
    expect(chooseWishCard(state, "1").playerStatuses.block).toBe(0);
    const noDeclines = {
      ...state,
      wishOptions: options.slice(0, 1),
      talentEffects: { ...state.talentEffects, blockPerDeclinedWishCard: 1 },
    };
    expect(chooseWishCard(noDeclines, "1").playerStatuses.block).toBe(0);
  });

  it("Coinmail grants Gold from actual Armor gained", () => {
    const state = battle({
      rng: () => 0,
      talentEffects: talents("gold", "gold-elite-drop"),
    });
    const result = applyArmorReward(state, 4, []);
    expect(result.gold).toBe(4);
    expect(result.playerStatuses.armor).toBe(4);
  });

  it("repeated Wish choices retain the normal offer size and payment", () => {
    const state = battle({
      talentEffects: computeTalentEffects({
        wish: ["wish-extra-choice"],
      }),
    });
    const wish = makeTestCard({ id: "wish", cost: 1, effects: [{ kind: "wish", amount: 1 }] });
    let next = state;
    for (let i = 0; i < 3; i++) {
      next = play(next, wish);
      expect(next.wishOptions).toHaveLength(3);
      next = chooseWishCard(next, next.wishOptions![0]!.id);
    }
    expect(next.mana).toBe(state.mana - 3);
    expect(next.playerStatuses.block).toBe(0);
  });
});
