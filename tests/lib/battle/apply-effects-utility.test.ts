import { describe, expect, it } from "vitest";
import { handleUtilityEffect } from "@/lib/battle/apply-effects-utility";
import { companionLibrary } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState, makeTestCard, seededRng } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("handleUtilityEffect", () => {
  it("gain-gold increases gold and emits combat text", () => {
    const state = createTestBattleState({ gold: 10 });
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 5 }] });
    const texts = makeTexts();
    const result = handleUtilityEffect(state, card, { kind: "gain-gold", amount: 5 }, 1, texts);
    expect(result.gold).toBe(15);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 5 });
  });

  it("gain-gold applies potion multiplier", () => {
    const state = createTestBattleState({ gold: 0 });
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 3 }] });
    const texts = makeTexts();
    const result = handleUtilityEffect(state, card, { kind: "gain-gold", amount: 3 }, 2, texts);
    expect(result.gold).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
  });

  it("draw-cards updates deck, discard, and hand", () => {
    const deck = [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" })];
    const state = createTestBattleState({ deck, discard: [], hand: [], rng: seededRng(1) });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 2 }] });
    const result = handleUtilityEffect(state, card, { kind: "draw-cards", amount: 2 }, 1, makeTexts());
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(0);
  });

  it("draw-cards reshuffles discard mid-draw when deck runs out", () => {
    const deck = [makeTestCard({ id: "d1" })];
    const discard = [makeTestCard({ id: "d2" }), makeTestCard({ id: "d3" })];
    const state = createTestBattleState({ deck, discard, hand: [], rng: seededRng(99) });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 3 }] });
    const result = handleUtilityEffect(state, card, { kind: "draw-cards", amount: 3 }, 1, makeTexts());
    expect(result.hand.map((c) => c.id).sort()).toEqual(["d1", "d2", "d3"]);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("remove-harmful-status clears harmful stacks", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 4, poison: 2 },
    });
    const card = makeTestCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const result = handleUtilityEffect(
      state,
      card,
      { kind: "remove-harmful-status", amount: 1 },
      1,
      makeTexts(),
    );
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(2);
  });

  it("summon-companion sets activeCompanion from library", () => {
    const state = createTestBattleState({ activeCompanion: null });
    const card = makeTestCard({ effects: [{ kind: "summon-companion", companionId: "imp" }] });
    const result = handleUtilityEffect(
      state,
      card,
      { kind: "summon-companion", companionId: "imp" },
      1,
      makeTexts(),
    );
    expect(result.activeCompanion).toEqual(companionLibrary.imp);
  });

  it("buff-companion increases companionDamageBuff", () => {
    const state = createTestBattleState({ companionDamageBuff: 1 });
    const card = makeTestCard({ effects: [{ kind: "buff-companion", amount: 2 }] });
    const result = handleUtilityEffect(state, card, { kind: "buff-companion", amount: 2 }, 1, makeTexts());
    expect(result.companionDamageBuff).toBe(3);
  });

  it("self-damage reduces health and applies status", () => {
    const state = createTestBattleState({ playerHealth: 20 });
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType: "bleed", amount: 4 }] });
    const texts = makeTexts();
    const result = handleUtilityEffect(
      state,
      card,
      { kind: "self-damage", damageType: "bleed", amount: 4 },
      1,
      texts,
    );
    expect(result.playerHealth).toBe(16);
    expect(result.playerStatuses.bleed).toBe(4);
    expect(texts.some((t) => t.kind === "damage" && t.stat === "bleed")).toBe(true);
  });

  it("lose-health reduces health without adding status", () => {
    const state = createTestBattleState({ playerHealth: 20 });
    const card = makeTestCard({ effects: [{ kind: "lose-health", amount: 5 }] });
    const texts = makeTexts();
    const result = handleUtilityEffect(state, card, { kind: "lose-health", amount: 5 }, 1, texts);
    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "health", amount: 5 });
  });

  it("wish queues options for selection", () => {
    const state = createTestBattleState({ wishOptions: null, wishQueue: [], rng: seededRng(7) });
    const card = makeTestCard({ id: "wish", effects: [{ kind: "wish", amount: 1 }] });
    const result = handleUtilityEffect(state, card, { kind: "wish", amount: 1 }, 1, makeTexts());
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishOptions!.length).toBeGreaterThan(0);
  });
});
