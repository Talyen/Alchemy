import { describe, expect, it } from "vitest";
import { buildWishOptions, applyWishEffect, chooseWishCard } from "@/lib/battle/wish";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";
import { MAX_HAND_SIZE } from "@/lib/game-constants";

describe("buildWishOptions", () => {
  it("returns shuffled options excluding the triggering card", () => {
    const card = {
      id: "strike",
      title: "Strike",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    };
    const state = createTestBattleState();
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => o.id !== "strike")).toBe(true);
    expect(options.every((o) => o.id && o.title)).toBe(true);
  });

  it("returns only undiscovered cards when wishUndiscoveredCards is active", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, wishUndiscoveredCards: true },
      discoveredCardIds: ["strike", "bash", "block"],
      rng: () => 0.99,
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
    expect(options.every((o) => !["strike", "bash", "block"].includes(o.id))).toBe(true);
  });

  it("falls back to all cards when not enough undiscovered exist", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, wishUndiscoveredCards: true },
      discoveredCardIds: (() => {
        const ids = [];
        for (let i = 0; i < 200; i++) ids.push(`card-${i}`);
        return ids;
      })(),
    });
    const options = buildWishOptions(state, card);
    expect(options).toHaveLength(3);
  });
});

describe("applyWishEffect", () => {
  it("returns same state when wish amount is 0", () => {
    const state = createTestBattleState();
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 0, texts);
    expect(result).toBe(state);
  });

  it("returns same state when wish amount is negative", () => {
    const state = createTestBattleState();
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, -1, texts);
    expect(result).toBe(state);
  });

  it("sets wishOptions when no existing wish is active", () => {
    const state = createTestBattleState({ wishOptions: null, wishQueue: [] });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishOptions).toHaveLength(3);
  });

  it("queues extra wishes when an existing wish is active", () => {
    const initialOptions = [{ id: "card-1", title: "Card 1", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    const state = createTestBattleState({ wishOptions: initialOptions, wishQueue: [] });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.wishOptions).toBe(initialOptions);
    expect(result.wishQueue).toHaveLength(1);
  });

  it("awards goldOnWish per wish count", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, goldOnWish: 5 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 2, texts);
    expect(result.gold).toBe(10);
    // mergeCombatText deduplicates by (target, kind, stat), so gold events merge
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 10 }]);
  });

  it("awards goldOnWishAmount per wish", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, goldOnWishAmount: 3 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(3);
  });

  it("awards wishingWellGoldOnWish per wish", () => {
    const state = createTestBattleState({
      boonEffects: { ...createTestBattleState().boonEffects, wishingWellGoldOnWish: 7 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(7);
  });

  it("heals player with healthOnWish per wish", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      talentEffects: { ...createTestBattleState().talentEffects, healthOnWish: 4 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerHealth).toBe(24);
  });

  it("removes harmful status with removeHarmfulStatusOnWish", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 5, poison: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, removeHarmfulStatusOnWish: true },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(3);
  });

  it("draws card with wishDrawsCard", () => {
    const card = {
      id: "strike",
      title: "Strike",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    };
    const state = createTestBattleState({
      deck: [card],
      talentEffects: { ...createTestBattleState().talentEffects, wishDrawsCard: true },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.hand).toHaveLength(1);
    expect(result.deck).toHaveLength(0);
  });

  it("combines multiple gold bonuses from same wish", () => {
    const state = createTestBattleState({
      talentEffects: {
        ...createTestBattleState().talentEffects,
        goldOnWish: 5,
        goldOnWishAmount: 3,
      },
      boonEffects: { ...createTestBattleState().boonEffects, wishingWellGoldOnWish: 2 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 1, texts);
    expect(result.gold).toBe(10);
  });

  it("applies per-wish effects for each wish count", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      talentEffects: { ...createTestBattleState().talentEffects, healthOnWish: 3, goldOnWish: 2 },
    });
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const texts: CombatTextEvent[] = [];
    const result = applyWishEffect(state, card, 3, texts);
    expect(result.playerHealth).toBe(29);
    expect(result.gold).toBe(6);
  });
});

describe("chooseWishCard", () => {
  it("assigns unique uid when card is added to hand", () => {
    const card = { id: "chosen-card", title: "Chosen", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = createTestBattleState({
      wishOptions: [card],
      wishQueue: [],
      nextCardUid: 42,
      hand: [],
    });
    const result = chooseWishCard(state, "chosen-card");
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].uid).toBe(42);
    expect(result.nextCardUid).toBe(43);
  });

  it("assigns unique uid when card is added to discard due to full hand", () => {
    const card = { id: "chosen-card", title: "Chosen", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const fullHand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => ({
      id: `c-${i}`,
      title: `Card ${i}`,
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [],
    }));
    const state = createTestBattleState({
      wishOptions: [card],
      wishQueue: [],
      nextCardUid: 100,
      hand: fullHand,
      discard: [],
    });
    const result = chooseWishCard(state, "chosen-card");
    expect(result.discard).toHaveLength(1);
    expect(result.discard[0].uid).toBe(100);
    expect(result.nextCardUid).toBe(101);
  });
});

describe("new wish talents", () => {
  it("wishBoonChoice grants 1 forge or 1 armor depending on RNG", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const stateForge = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 0, armor: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, wishBoonChoice: true },
      rng: () => 0.1, // < 0.5 -> forge
    });
    const stateArmor = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 0, armor: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, wishBoonChoice: true },
      rng: () => 0.6, // >= 0.5 -> armor
    });

    const resultForge = applyWishEffect(stateForge, card, 1, []);
    expect(resultForge.playerStatuses.forge).toBe(1);
    expect(resultForge.playerStatuses.armor).toBe(0);

    const resultArmor = applyWishEffect(stateArmor, card, 1, []);
    expect(resultArmor.playerStatuses.armor).toBe(1);
    expect(resultArmor.playerStatuses.forge).toBe(0);
  });

  it("wishBlockBelowHealthPct grants 6 block below 30% health threshold", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const stateBelow = createTestBattleState({
      playerHealth: 8, // below 9 (30 max health is 30)
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, wishBlockBelowHealthPct: 30 },
    });
    const stateAbove = createTestBattleState({
      playerHealth: 15, // above 9
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, wishBlockBelowHealthPct: 30 },
    });

    const resultBelow = applyWishEffect(stateBelow, card, 1, []);
    expect(resultBelow.playerStatuses.block).toBe(6);

    const resultAbove = applyWishEffect(stateAbove, card, 1, []);
    expect(resultAbove.playerStatuses.block).toBe(0);
  });

  it("wishCardsUpgraded upgrades card numeric values by 1", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [] };
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, wishCardsUpgraded: true },
    });
    const options = buildWishOptions(state, card);

    // Verify that all cards returned by buildWishOptions with editable targets are indeed upgraded.
    options.forEach((o) => {
      // Check that it has some upgraded values compared to a fresh instance
      const original = createTestBattleState().deck.find((d) => d.id === o.id);
      if (original) {
        o.effects.forEach((eff, idx) => {
          if ("amount" in eff) {
            const origEff = original.effects[idx];
            if (origEff && "amount" in origEff) {
              expect(eff.amount).toBe(origEff.amount + 1);
            }
          }
        });
      }
    });
  });
});
