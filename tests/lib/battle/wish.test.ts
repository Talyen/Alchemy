import { describe, expect, it } from "vitest";
import { buildWishOptions, applyWishEffect } from "@/lib/battle/wish";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

describe("buildWishOptions", () => {
  it("returns shuffled options excluding the triggering card", () => {
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] };
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
      discoveredCardIds: (() => { const ids = []; for (let i = 0; i < 200; i++) ids.push(`card-${i}`); return ids; })(),
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
      trinketEffects: { ...createTestBattleState().trinketEffects, wishingWellGoldOnWish: 7 },
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
    const card = { id: "strike", title: "Strike", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }] };
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
      trinketEffects: { ...createTestBattleState().trinketEffects, wishingWellGoldOnWish: 2 },
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
