import { describe, expect, it, vi } from "vitest";
import { battleSnapshot, resolveBattleCard, resolveBattleTurn, resolveBattleWish } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import {
  addCardToHandOrQueue,
  applyDrawResult,
  drawFromState,
  drawKeywordCard,
  takeRandomCardFromDeck,
} from "@/lib/battle/draw";
import { cardById, companionLibrary } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCardWithId, patchBattleState } from "../../fixtures/battle";
import { runHandDrawSequence } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { makeDrawSequenceDeps } from "../../features/alchemy/run-loop/battle/turn-orchestration-fixture";

describe("resolved draw presentation receipts", () => {
  it("keeps actual repeated Owl draws separate from gameplay and preserves RNG, order, UIDs and overflow", () => {
    const card = cardById["pack-tactics"]!;
    const make = () =>
      patchBattleState({
        hand: [{ ...card, uid: 0 }],
        deck: Array.from({ length: 12 }, (_, index) => makeTestCardWithId(`deck-${index}`)),
        nextCardUid: 1,
        activeCompanion: companionLibrary["library-owl"],
        flags: { playNextCardTwice: true },
        talentEffects: {
          companionBondLevels: { ...patchBattleState().talentEffects.companionBondLevels, "library-owl": 1 },
        },
        rng: vi.fn(() => 0),
      });
    const baseline = make();
    const expected = playBattleCardResolved(baseline, card.id, 0);
    const state = make();
    const received: number[] = [];
    const result = resolveBattleCard(battleSnapshot(state), card.id, 0, {
      rng: state.rng,
      onCardsDrawn: (uids) => received.push(...uids),
    });
    expect(result.drawnCardUids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(received).toEqual(result.drawnCardUids);
    expect(result.state.hand.map(({ id, uid }) => [id, uid])).toEqual(
      Array.from({ length: MAX_HAND_SIZE }, (_, index) => [`deck-${11 - index}`, index + 1]),
    );
    expect(result.state.pendingHandCards).toMatchObject([{ id: "deck-4", uid: 8 }]);
    expect(result.companionActions).toHaveLength(8);
    expect(result.state).toEqual(battleSnapshot(expected.state));
    expect(result.combatTexts).toEqual(expected.combatTexts);
    expect(state.rng).toHaveBeenCalledTimes(vi.mocked(baseline.rng).mock.calls.length);
    expect(result.state).not.toHaveProperty("onCardsDrawn");
  });

  it("records turn draws before the Owl's additional draw, independently on successive turns", () => {
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({
      playerHealth: 1000,
      playerMaxHealth: 1000,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      hand: [],
      deck: Array.from({ length: 20 }, (_, index) => makeTestCardWithId(`deck-${index}`)),
      nextCardUid: 10,
      activeCompanion: companionLibrary["library-owl"],
      rng,
    });
    const first = resolveBattleTurn(battleSnapshot(state), { rng });
    const frame = first.frames[0]!;
    expect(frame.drawnCardUids).toEqual(frame.turn.state.hand.map((card) => card.uid));
    expect(frame.companion?.drawnCardUids).toEqual([frame.turn.state.nextCardUid]);
    expect(first.state.hand.at(-1)?.uid).toBe(frame.companion?.drawnCardUids?.[0]);
    const second = resolveBattleTurn(first.state, { rng });
    expect(second.frames[0]?.companion?.drawnCardUids).toEqual([second.frames[0]!.turn.state.nextCardUid]);
    expect(second.state).not.toHaveProperty("onCardsDrawn");
    expect(second.frames[0]?.drawnCardUids).not.toEqual(frame.drawnCardUids);
  });

  it("does not call a created Wish card a deck draw, even when its ID matches the real draw", () => {
    const receipts: number[] = [];
    const card = cardById.slash!;
    const initial = patchBattleState({
      hand: [],
      deck: [card],
      nextCardUid: 20,
      onCardsDrawn: (uids) => receipts.push(...uids),
    });
    const created = addCardToHandOrQueue(initial, card);
    expect(receipts).toEqual([]);
    const drawn = applyDrawResult(created, drawFromState(created, 1));
    expect(receipts).toEqual([21]);
    expect(drawn.hand.map(({ id, uid }) => [id, uid])).toEqual([
      [card.id, 20],
      [card.id, 21],
    ]);
    const chosen = resolveBattleWish(battleSnapshot({ ...initial, wishOptions: [card] }), card.id, {
      rng: initial.rng,
    });
    expect(chosen.state.hand).toMatchObject([{ id: card.id, uid: 20 }]);
    expect(chosen.drawnCardUids ?? []).toEqual([]);
  });

  it("reports actual keyword and random deck draws through the same draw boundary", () => {
    for (const kind of ["keyword", "random"] as const) {
      const onCardsDrawn = vi.fn();
      const state = patchBattleState({
        hand: [],
        deck: [cardById.slash!],
        nextCardUid: 10,
        onCardsDrawn,
      });
      if (kind === "keyword") drawKeywordCard(state, "physical");
      else takeRandomCardFromDeck(state);
      expect(onCardsDrawn).toHaveBeenCalledExactlyOnceWith([10]);
    }
  });

  it.each(["wish", "draw"] as const)(
    "settles a full-hand %s queue delivery after resume and a later play without inventing a new deck draw",
    async (source) => {
      const received = cardById.block!;
      const initial = patchBattleState({
        hand: Array.from({ length: MAX_HAND_SIZE }, (_, uid) => ({ ...cardById.slash!, uid })),
        deck: [received],
        discard: [],
        nextCardUid: 20,
        enemyHealth: 1000,
        enemyMaxHealth: 1000,
        wishOptions: source === "wish" ? [received] : null,
      });
      const queued =
        source === "wish"
          ? resolveBattleWish(battleSnapshot(initial), received.id, { rng: initial.rng }).state
          : battleSnapshot(applyDrawResult(initial, drawFromState(initial, 1)));
      expect(queued.hand).toEqual(initial.hand);
      expect(queued.pendingHandCards).toMatchObject([{ id: received.id, uid: 20 }]);
      // Exercise the existing save representation, with no transient origin hook.
      const restored: typeof queued = JSON.parse(JSON.stringify(queued));
      const rng = vi.fn(() => 0.99);
      const result = resolveBattleCard(restored, initial.hand[0]!.id, 0, { rng });
      const baselineRng = vi.fn(() => 0.99);
      const baseline = playBattleCardResolved({ ...restored, rng: baselineRng }, initial.hand[0]!.id, 0);
      expect(result.state.hand.map(({ uid }) => uid)).toEqual([1, 2, 3, 4, 5, 6, 20]);
      expect(result.state.pendingHandCards).toEqual([]);
      expect(result.state.nextCardUid).toBe(21);
      expect(result.drawnCardUids).toEqual([]);
      expect(result.state).toEqual(battleSnapshot(baseline.state));
      expect(rng).toHaveBeenCalledTimes(baselineRng.mock.calls.length);
      const deps = makeDrawSequenceDeps();
      const onReveal = vi.fn();
      await expect(
        runHandDrawSequence(restored.hand, result.state, onReveal, 0, deps, result.drawnCardUids),
      ).resolves.toBe(false);
      expect(onReveal).toHaveBeenCalledOnce();
      expect(deps.animateDrawnHand).not.toHaveBeenCalled();
      expect(deps.setHiddenHandCardKeys).not.toHaveBeenCalled();
      expect(deps.playback.pendingDraws).toBe(0);
    },
  );

  it("hides and flies only the actual draw when a created card has the same ID", async () => {
    const created = { ...cardById.slash!, uid: 20 };
    const drawn = { ...cardById.slash!, uid: 21 };
    const state = battleSnapshot(patchBattleState({ hand: [created, drawn] }));
    let hidden: string[] = [];
    const onReveal = vi.fn(() => expect(hidden).toEqual(["slash-21"]));
    const deps = makeDrawSequenceDeps({
      setHiddenHandCardKeys: (update) => {
        hidden = [...update(hidden)];
      },
    });
    await runHandDrawSequence([], state, onReveal, 0, deps, [21]);
    expect(onReveal).toHaveBeenCalledOnce();
    expect(deps.animateDrawnHand).toHaveBeenCalledExactlyOnceWith([drawn], state.hand, 0);
    expect(hidden).toEqual([]);
    expect(deps.playback.pendingDraws).toBe(0);
  });
});
