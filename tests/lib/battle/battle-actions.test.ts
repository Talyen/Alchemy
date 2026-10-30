import { describe, expect, it, vi } from "vitest";
import {
  battleSnapshot,
  resolveBattleAction,
  resolveBattleCard,
  resolveBattleWish,
  resolveBattleTurn,
} from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { chooseWishCard } from "@/lib/battle/wish";
import { createSeededRng } from "@/lib/rng";
import { makeTestBattleState, makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("player action host boundary", () => {
  it("replays random Card and Wish rewards from a cloned snapshot without retaining execution capabilities", () => {
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
    const snapshot = battleSnapshot(makeTestBattleState({ hand: [card], mana: 10 }));
    snapshot.talentEffects = { ...snapshot.talentEffects, declinedWishCardChance: 100 };
    const before = structuredClone(snapshot);
    const run = (seed: number) => {
      const context = { rng: createSeededRng(seed) };
      const played = resolveBattleCard(structuredClone(snapshot), card.id, 0, context);
      const chosen = resolveBattleWish(structuredClone(played.state), played.state.wishOptions![0]!.id, context);
      return { played, chosen, nextRoll: context.rng() };
    };
    const result = run(42);
    expect(run(42)).toEqual(result);
    expect(snapshot).toEqual(before);
    expect(() => structuredClone(result)).not.toThrow();
    expect(result.chosen.state.hand).toHaveLength(2);
    expect(result.chosen.state.playerStatuses.block).toBe(0);

    // The host matches direct engine calls, including random-stream consumption.
    const rng = createSeededRng(42);
    const played = playBattleCardResolved({ ...snapshot, rng }, card.id, 0);
    const texts: typeof played.combatTexts = [];
    const chosen = chooseWishCard(played.state, played.state.wishOptions![0]!.id);
    expect(result).toEqual({
      played: { ...played, state: battleSnapshot(played.state), companionActions: [], drawnCardUids: [] },
      chosen: { state: battleSnapshot(chosen), combatTexts: texts },
      nextRoll: rng(),
    });
  });

  it.each([
    { name: "pending Wish", patch: { wishOptions: [makeTestCard()] } },
    { name: "enemy phase", patch: { turnPhase: "enemy" as const } },
  ])("rejects turn completion during $name before any combat or RNG", ({ patch }) => {
    const snapshot = battleSnapshot(makeTestBattleState(patch));
    const before = structuredClone(snapshot);
    const rng = vi.fn(() => 0.5);
    expect(resolveBattleTurn(snapshot, { rng })).toEqual({ state: snapshot, frames: [] });
    expect(resolveBattleAction(snapshot, { kind: "end-turn" }, { rng })).toMatchObject({
      kind: "rejected",
      state: snapshot,
    });
    expect(snapshot).toEqual(before);
    expect(rng).not.toHaveBeenCalled();
  });

  it("pauses forced skipped turns when delayed Holy damage opens a Wish", () => {
    const snapshot = battleSnapshot(
      patchBattleState({
        deck: [makeTestCard()],
        playerHealth: 1000,
        playerMaxHealth: 1000,
        enemyHealth: 1000,
        enemyMaxHealth: 1000,
        currentEnemy: { traits: [] },
        playerCC: { freezeSkipTurns: 2 },
        talentEffects: { holyWishChance: 100 },
        // Transmuting Blizzard to Holy retains its delayed hit.
        pendingTurnStartEffects: [{ remainingTurns: 1, effects: [{ kind: "damage", damageType: "holy", amount: 2 }] }],
      }),
    );
    const context = { rng: () => 0.05 };
    const result = resolveBattleTurn(snapshot, context);
    expect(result.state.wishOptions).not.toBeNull();
    expect(result.frames).toHaveLength(1);
    expect(result.state.playerCC.freezeSkipTurns).toBe(1);
    expect(resolveBattleWish(result.state, result.state.wishOptions![0]!.id, context).state.wishOptions).toBeNull();
  });

  it.each([
    { name: "enemy phase", patch: { turnPhase: "enemy" as const } },
    { name: "defeat", patch: { playerHealth: 0, deathsDoorUsed: true } },
  ])("rejects an offered Wish during $name", ({ patch }) => {
    const choice = makeTestCard();
    const snapshot = battleSnapshot(makeTestBattleState({ ...patch, wishOptions: [choice] }));
    const rng = vi.fn(() => 0.5);
    expect(resolveBattleWish(snapshot, choice.id, { rng }).state).toBe(snapshot);
    expect(resolveBattleAction(snapshot, { kind: "wish", cardId: choice.id }, { rng })).toMatchObject({
      kind: "rejected",
      state: snapshot,
    });
    expect(rng).not.toHaveBeenCalled();
  });

  it("keeps finishing actions explicit without reopening a completed turn", () => {
    const card = makeTestCard({ effects: [{ kind: "gain-gold", amount: 3 }] });
    const snapshot = battleSnapshot(makeTestBattleState({ enemyHealth: 0, hand: [card] }));
    const rng = vi.fn(() => 0.5);
    expect(resolveBattleAction(snapshot, { kind: "card", cardId: card.id, index: 0 }, { rng }).kind).toBe("rejected");
    const played = resolveBattleAction(
      snapshot,
      { kind: "card", cardId: card.id, index: 0, options: { allowAfterEnemyDefeat: true } },
      { rng },
    );
    expect(played.kind).toBe("accepted");
    if (played.kind !== "accepted" || played.action !== "card") throw new Error("Expected a finishing card");
    expect(played.card).toBe(card);
    expect(played.resolution.state.gold).toBe(snapshot.gold + 3);
    const choice = resolveBattleAction(
      { ...snapshot, wishOptions: [card], playerCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 } },
      { kind: "wish", cardId: card.id },
      { rng },
    );
    expect(choice.kind).toBe("accepted");
    expect(resolveBattleAction(snapshot, { kind: "end-turn" }, { rng }).kind).toBe("rejected");
  });

  it.each([0, -1, 0.5, NaN, Infinity])(
    "rejects invalid turn budget %s without resolving a partial action",
    (maxTurns) => {
      const snapshot = battleSnapshot(makeTestBattleState());
      const rng = vi.fn(() => 0.5);
      expect(resolveBattleAction(snapshot, { kind: "end-turn", maxTurns }, { rng })).toMatchObject({
        kind: "rejected",
        state: snapshot,
      });
      expect(rng).not.toHaveBeenCalled();
    },
  );

  it("rejects stale choices without consuming RNG or changing snapshot identity", () => {
    const snapshot = battleSnapshot(makeTestBattleState());
    const rng = vi.fn(() => 0.5);
    expect(resolveBattleCard(snapshot, "missing", 0, { rng }).state).toBe(snapshot);
    expect(resolveBattleWish(snapshot, "missing", { rng }).state).toBe(snapshot);
    expect(rng).not.toHaveBeenCalled();
  });
});
