import { describe, expect, it, vi } from "vitest";
import { battleSnapshot, resolveBattleCard, resolveBattleWish } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { chooseWishCard } from "@/lib/battle/wish";
import { createSeededRng } from "@/lib/rng";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";

describe("player action host boundary", () => {
  it("replays random Card and Wish rewards from a cloned snapshot without retaining execution capabilities", () => {
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
    const snapshot = battleSnapshot(makeTestBattleState({ hand: [card], mana: 10 }));
    snapshot.talentEffects = { ...snapshot.talentEffects, declinedWishCardChance: 100, blockPerDeclinedWishCard: 2 };
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
    expect(result.chosen.combatTexts.some((text) => text.stat === "block")).toBe(true);

    // Preserve the exact old mechanics, including random-stream consumption.
    const rng = createSeededRng(42);
    const played = playBattleCardResolved({ ...snapshot, rng }, card.id, 0);
    const texts: typeof played.combatTexts = [];
    const chosen = chooseWishCard(played.state, played.state.wishOptions![0]!.id, texts);
    expect(result).toEqual({
      played: { ...played, state: battleSnapshot(played.state) },
      chosen: { state: battleSnapshot(chosen), combatTexts: texts },
      nextRoll: rng(),
    });
  });

  it("rejects stale choices without consuming RNG or changing snapshot identity", () => {
    const snapshot = battleSnapshot(makeTestBattleState());
    const rng = vi.fn(() => 0.5);
    expect(resolveBattleCard(snapshot, "missing", 0, { rng }).state).toBe(snapshot);
    expect(resolveBattleWish(snapshot, "missing", { rng }).state).toBe(snapshot);
    expect(rng).not.toHaveBeenCalled();
  });
});
