import { describe, expect, it } from "vitest";
import { applyEffectByKind } from "@/lib/battle/effect-handlers/registry";
import { companionLibrary } from "@/lib/game-data";
import { makeCombatTexts as makeTexts, makeTestBattleState, makeTestCard, seededRng } from "../../fixtures/battle";

describe("applyEffectByKind (utility effects)", () => {
  it("gain-gold increases gold and emits combat text", () => {
    const state = makeTestBattleState({ gold: 10 });
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 5 }] });
    const texts = makeTexts();
    const effect = { kind: "gain-gold" as const, amount: 5 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, texts);
    expect(result.gold).toBe(15);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 5 });
  });

  it("scales gain-gold combat text with goldGainPercent", () => {
    const state = makeTestBattleState({
      gold: 10,
      gearEffects: { ...makeTestBattleState().gearEffects, goldGainPercent: 50 },
    });
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 5 }] });
    const texts = makeTexts();
    const effect = { kind: "gain-gold" as const, amount: 5 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, texts);
    expect(result.gold).toBe(18);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("gain-gold applies potion multiplier", () => {
    const state = makeTestBattleState({ gold: 0 });
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 3 }] });
    const texts = makeTexts();
    const effect = { kind: "gain-gold" as const, amount: 3 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 2, texts);
    expect(result.gold).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
  });

  it("draw-cards updates deck, discard, and hand", () => {
    const deck = [makeTestCard({ id: "d1" }), makeTestCard({ id: "d2" })];
    const state = makeTestBattleState({ deck, discard: [], hand: [], rng: seededRng(1) });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 2 }] });
    const effect = { kind: "draw-cards" as const, amount: 2 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(0);
  });

  it("draw-cards reshuffles discard mid-draw when deck runs out", () => {
    const deck = [makeTestCard({ id: "d1" })];
    const discard = [makeTestCard({ id: "d2" }), makeTestCard({ id: "d3" })];
    const state = makeTestBattleState({ deck, discard, hand: [], rng: seededRng(99) });
    const card = makeTestCard({ effects: [{ kind: "draw-cards", amount: 3 }] });
    const effect = { kind: "draw-cards" as const, amount: 3 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.hand.map((c) => c.id).sort()).toEqual(["d1", "d2", "d3"]);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("remove-harmful-status clears harmful stacks", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, burn: 4, poison: 2 },
    });
    const card = makeTestCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const effect = { kind: "remove-harmful-status" as const, amount: 1 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(2);
  });

  it("summon-companion sets activeCompanion from library", () => {
    const state = makeTestBattleState({ activeCompanion: null });
    const card = makeTestCard({ effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    const effect = { kind: "summon-companion" as const, companionId: "wolf" as const };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.activeCompanion).toEqual(companionLibrary.wolf);
  });

  it("buff-companion increases companionDamageBuff", () => {
    const state = makeTestBattleState({ companionDamageBuff: 1 });
    const card = makeTestCard({ effects: [{ kind: "buff-companion", amount: 2 }] });
    const effect = { kind: "buff-companion" as const, amount: 2 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.companionDamageBuff).toBe(3);
  });

  it("self-damage reduces health and applies status", () => {
    const state = makeTestBattleState({ playerHealth: 20 });
    const card = makeTestCard({ effects: [{ kind: "self-damage", damageType: "bleed", amount: 4 }] });
    const texts = makeTexts();
    const effect = { kind: "self-damage" as const, damageType: "bleed" as const, amount: 4 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, texts);
    expect(result.playerHealth).toBe(16);
    expect(result.playerStatuses.bleed).toBe(4);
    expect(texts.some((t) => t.kind === "damage" && t.stat === "bleed")).toBe(true);
  });

  it("lose-health reduces health without adding status", () => {
    const state = makeTestBattleState({ playerHealth: 20 });
    const card = makeTestCard({ effects: [{ kind: "lose-health", amount: 5 }] });
    const texts = makeTexts();
    const effect = { kind: "lose-health" as const, amount: 5 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, texts);
    expect(result.playerHealth).toBe(15);
    expect(result.playerStatuses.bleed).toBe(0);
    expect(texts).toContainEqual({ target: "player", kind: "damage", stat: "health", amount: 5 });
  });

  it("wish queues options for selection", () => {
    const state = makeTestBattleState({ wishOptions: null, wishQueue: [], rng: seededRng(7) });
    const card = makeTestCard({ id: "wish", effects: [{ kind: "wish", amount: 1 }] });
    const effect = { kind: "wish" as const, amount: 1 };
    const result = applyEffectByKind(effect.kind, state, card, effect, 1, makeTexts());
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishOptions!.length).toBeGreaterThan(0);
  });
});
