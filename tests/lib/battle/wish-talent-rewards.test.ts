import { addGoldWithCombatText } from "@/lib/battle/combat-text";
import { buildWishOptions, chooseWishCard } from "@/lib/battle/wish";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { computeTalentEffects } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { describe, expect, it } from "vitest";
import { makeTestCard } from "../../fixtures/cards";
import * as talentBattle from "../../fixtures/talent-battle";

describe("Talent wish talent rewards", () => {
  const { talents, battle, attack, play } = talentBattle;

  it("guarantees the only undiscovered Wish card and expands each queued offer", () => {
    const pool = getOfferableCardPool();
    const missing = pool.find((card) => card.id !== "wish")!;
    const state = battle({
      talentEffects: talents("wish", "wish-undiscovered", "wish-extra-choice"),
      discoveredCardIds: pool.filter((card) => card.id !== missing.id).map((card) => card.id),
    });
    const options = buildWishOptions(state, makeTestCard({ id: "wish" }));
    expect(options).toHaveLength(4);
    expect(options.map((card) => card.id)).toContain(missing.id);
    expect(new Set(options.map((card) => card.id)).size).toBe(4);
    expect(
      buildWishOptions({ ...state, discoveredCardIds: pool.map((card) => card.id) }, makeTestCard({ id: "wish" })),
    ).toHaveLength(4);
  });

  it("pays Roads Not Taken only for a valid selection, including full hands and queued Wishes", () => {
    const options = [attack("1"), attack("2"), attack("3"), attack("4")];
    const state = battle({
      talentEffects: talents("wish", "wish-gold"),
      wishOptions: options,
      wishQueue: [options.slice(0, 2)],
      hand: Array.from({ length: MAX_HAND_SIZE }, (_, i) => attack(`hand-${i}`)),
    });
    expect(chooseWishCard(state, "invalid")).toBe(state);
    const after = chooseWishCard(state, "1");
    expect(after.playerStatuses.block).toBe(3);
    expect(after.discard.at(-1)?.id).toBe("1");
    const final = chooseWishCard(after, "2");
    expect(final.playerStatuses.block).toBe(4);
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

  it("Coinmail grants Block from actual Gold earned only while empty", () => {
    const state = battle({ talentEffects: talents("gold", "gold-elite-drop"), gearEffects: { goldGainPercent: 100 } });
    const once = addGoldWithCombatText(state, 2, []);
    const twice = addGoldWithCombatText(once, 2, []);
    expect(twice.gold - state.gold).toBe(8);
    expect(twice.playerStatuses.block).toBe(1);
    expect(addGoldWithCombatText(twice, 0)).toBe(twice);
  });

  it("repeated Wish choices combine Coinmail, Generous Wish and Roads Not Taken without Mana refunds", () => {
    const state = battle({
      talentEffects: computeTalentEffects({
        wish: ["wish-extra-choice", "wish-gold"],
        gold: ["gold-elite-drop", "gold-on-wish"],
      }),
    });
    const wish = makeTestCard({ id: "wish", cost: 1, effects: [{ kind: "wish", amount: 1 }] });
    let next = state;
    for (let i = 0; i < 3; i++) {
      next = play(next, wish);
      expect(next.wishOptions).toHaveLength(4);
      next = chooseWishCard(next, next.wishOptions![0]!.id);
    }
    expect(next.gold).toBe(3);
    expect(next.mana).toBe(state.mana - 3);
    expect(next.playerStatuses.block).toBe(9);
  });
});
