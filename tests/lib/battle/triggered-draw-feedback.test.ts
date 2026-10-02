import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { applyWishEffect } from "@/lib/battle/wish";
import { addPlayerStatusWithCombatText } from "@/lib/battle/player-rewards";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { CombatTextEvent } from "@/lib/battle/types";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const drawnCard = cardById["tithe"]!;
const drawText = (amount: number) => ({ target: "player", kind: "status", stat: "draw", amount });

describe("triggered card draw feedback", () => {
  it("reports Thaw Dividend when the enemy's last Frozen turn expires", () => {
    const state = patchBattleState({
      deck: [cardById.slash!],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyCC: { freezeSkipTurns: 1 },
      talentEffects: { drawOnThaw: 1 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.hand).toContainEqual(expect.objectContaining({ id: "slash" }));
    expect(result.state.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.enemyResolutionCombatTexts).toContainEqual(drawText(1));
  });

  it("reports the Companion drawn by a critical Archery hit", () => {
    const card = cardById["bounty-shot"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [cardById["wolf-companion"]!],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { nextHitCrit: true },
      gearEffects: { archeryCritDrawsCompanion: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toEqual([expect.objectContaining({ id: "wolf-companion" })]);
    expect(result.combatTexts).toContainEqual(drawText(1));
  });

  it("reports the Archery card drawn on Dodge", () => {
    const state = patchBattleState({
      deck: [cardById["bounty-shot"]!],
      gearEffects: { archeryDodgeAndDraw: 1 },
      rng: () => 0,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 2 }] }),
      texts,
    );
    expect(next.hand).toEqual([expect.objectContaining({ id: "bounty-shot" })]);
    expect(texts).toContainEqual(drawText(1));
  });

  it.each(["eagle-eye", "hunters-bond", "archery-gear"])("reports %s card-play draws", (source) => {
    const companion = source === "hunters-bond";
    const card = cardById[companion ? "wolf-companion" : "bounty-shot"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [drawnCard],
      enemyCC: { stunSkipTurns: 1 },
      talentEffects: computeTalentEffects(
        companion
          ? { companion: ["companion-hunters-bond"] }
          : source === "eagle-eye"
            ? { archery: ["archery-eagle-eye"] }
            : {},
      ),
      gearEffects: { archeryDrawChance: source === "archery-gear" ? 100 : 0 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toEqual([expect.objectContaining({ id: drawnCard.id })]);
    expect(result.combatTexts).toContainEqual(drawText(1));
  });

  it.each([0, MAX_HAND_SIZE])("reports Wish draws with %i cards in hand", (handSize) => {
    const state = patchBattleState({
      hand: Array.from({ length: handSize }, () => makeTestCard()),
      deck: [drawnCard, drawnCard],
      talentEffects: computeTalentEffects({ wish: ["wish-draw"] }),
      gearEffects: { drawOnWish: 1 },
      rng: () => 0.05,
    });
    const texts: CombatTextEvent[] = [];
    const next = applyWishEffect(state, undefined, 1, texts);
    expect(next.hand.length + next.pendingHandCards.length).toBe(handSize + 2);
    expect(texts).toContainEqual(drawText(2));
  });

  it.each(["attack", "follow-up", "tick", "detonation"])("reports Bloodrush draws from a Bleed %s", (source) => {
    const card = cardById["serrated-arrowhead"]!;
    const state = patchBattleState({
      hand: source === "attack" ? [card] : [],
      deck: [drawnCard],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyCC: { stunSkipTurns: source === "attack" ? 1 : 0 },
      enemyStatuses: { bleed: source === "attack" ? 0 : 2 },
      talentEffects: { drawOnBleedDamageChance: 100 },
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const result = source === "attack" ? playBattleCardResolved(state, card.id, 0) : null;
    const next =
      result?.state ??
      (source === "follow-up"
        ? resolveFollowUpHit(state, { source: "talent-fixed", damageType: "bleed", amount: 2 }, texts)
        : source === "tick"
          ? tickEnemyStatuses(state, texts)
          : detonateEnemyStatuses(state, ["bleed"], texts));
    expect(next.hand).toEqual([expect.objectContaining({ id: drawnCard.id })]);
    expect(result?.combatTexts ?? texts).toContainEqual(drawText(1));
  });

  it.each([0, MAX_HAND_SIZE])("reports Radiant Guard's Holy draw with %i cards in hand", (handSize) => {
    const state = patchBattleState({
      hand: Array.from({ length: handSize }, () => makeTestCard()),
      deck: [drawnCard],
      talentEffects: { drawHolyOnBlockChance: 100 },
    });
    const texts: CombatTextEvent[] = [];
    const next = addPlayerStatusWithCombatText(state, "block", 2, texts);
    expect(next.hand.length + next.pendingHandCards.length).toBe(handSize + 1);
    expect(texts).toContainEqual(drawText(1));
  });

  it("reports Twin Casting's draw into a full hand queue", () => {
    const card = cardById["fireball"]!;
    const state = patchBattleState({
      hand: [card, ...Array.from({ length: MAX_HAND_SIZE - 1 }, () => makeTestCard())],
      pendingHandCards: [makeTestCard()],
      deck: [cardById["frostbolt"]!],
      gearEffects: { elementalTwinCasting: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toHaveLength(MAX_HAND_SIZE);
    expect(result.state.pendingHandCards).toEqual([expect.objectContaining({ id: "frostbolt" })]);
    expect(result.combatTexts).toContainEqual(drawText(1));
  });

  it("does not report a Twin Casting draw when only discard contains a matching card", () => {
    const card = cardById["fireball"]!;
    const state = patchBattleState({
      hand: [card],
      deck: [],
      discard: [cardById["frostbolt"]!],
      gearEffects: { elementalTwinCasting: 1 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toEqual([]);
    expect(result.combatTexts.some((text) => text.stat === "draw")).toBe(false);
  });

  it("does not count an older queued card as a new Hunter's Bond draw", () => {
    const card = cardById["wolf-companion"]!;
    const queued = { ...drawnCard, uid: 42 };
    const state = patchBattleState({
      hand: [card],
      pendingHandCards: [queued],
      deck: [],
      discard: [],
      talentEffects: computeTalentEffects({ companion: ["companion-hunters-bond"] }),
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toEqual([queued]);
    expect(result.state.pendingHandCards).toEqual([]);
    expect(result.combatTexts.some((text) => text.stat === "draw")).toBe(false);
  });

  it("does not report Wish or Radiant Guard draws that find no card", () => {
    const state = patchBattleState({
      hand: [],
      deck: [cardById["slash"]!],
      discard: [],
      talentEffects: { drawHolyOnBlockChance: 100 },
      gearEffects: { drawOnWish: 2 },
    });
    const holyTexts: CombatTextEvent[] = [];
    const guarded = addPlayerStatusWithCombatText(state, "block", 2, holyTexts);
    expect(guarded.hand).toEqual([]);
    expect(holyTexts.some((text) => text.stat === "draw")).toBe(false);
    const wishTexts: CombatTextEvent[] = [];
    const wished = applyWishEffect({ ...state, deck: [] }, undefined, 1, wishTexts);
    expect(wished.hand).toEqual([]);
    expect(wishTexts.some((text) => text.stat === "draw")).toBe(false);
  });
});
