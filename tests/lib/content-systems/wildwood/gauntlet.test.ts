import { describe, expect, it, vi } from "vitest";
import {
  canSkipWildwoodRemoval,
  createWildwoodBossBag,
  drawWildwoodBoss,
  enterWildwoodBattle,
  enterWildwoodRemoval,
  enterWildwoodReward,
  offeredWildwoodDraftCard,
  pickWildwoodDraftCard,
  prepareNextWildwoodBoss,
  removeWildwoodCard,
  type WildwoodDraftState,
} from "@/lib/content-systems/wildwood/gauntlet";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";
import { createRunRngState, createRunStateRng } from "@/lib/rng";
import { makeTestCard } from "../../../fixtures/cards";

function draftState(overrides: Partial<WildwoodDraftState> = {}): WildwoodDraftState {
  return {
    phase: "draft",
    draftChoices: [makeTestCard({ id: "slash" }), makeTestCard({ id: "block" })],
    remainingBossIds: ["iron-bear"],
    previousBossId: null,
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: [],
    ...overrides,
  };
}

function card(id: string): BattleCard {
  return makeTestCard({ id });
}

describe("Wildwood Draft gauntlet rules", () => {
  it("refills every boss once and repairs an actual boundary repeat without rerolling", () => {
    const bag = createWildwoodBossBag(() => 0.5);
    const rng = vi.fn(() => 0.5);
    const draw = drawWildwoodBoss([], bag[0]!, rng);
    expect(draw.bossId).toBe(bag[1]);
    expect(draw.remainingBossIds).toEqual([bag[0], ...bag.slice(2)]);
    expect([draw.bossId, ...draw.remainingBossIds].sort()).toEqual([...WILDWOOD_BOSS_IDS].sort());
    expect(rng).toHaveBeenCalledTimes(WILDWOOD_BOSS_IDS.length - 1);
  });

  it("consumes the next boss without mutating the bag or drawing randomness", () => {
    const bag = Object.freeze(["forge-golem", "iron-bear"] as const);
    const rng = vi.fn(() => 0.5);
    expect(drawWildwoodBoss(bag, "frostwarden", rng)).toEqual({
      bossId: "forge-golem",
      remainingBossIds: ["iron-bear"],
    });
    expect(rng).not.toHaveBeenCalled();
    expect(bag).toEqual(["forge-golem", "iron-bear"]);
  });
});

describe("Wildwood draft picks", () => {
  it("accepts an offered card and refreshes choices below the draft limit", () => {
    const rng = vi.fn(() => 0.5);
    const pick = pickWildwoodDraftCard(draftState(), "knight", [], "slash", rng);
    expect(pick?.card.id).toBe("slash");
    expect(pick?.state.draftChoices.length).toBeGreaterThan(0);
    expect(rng).toHaveBeenCalled();
  });

  it("rejects a non-offered card without drawing RNG", () => {
    const rng = vi.fn(() => 0.5);
    expect(offeredWildwoodDraftCard(draftState(), [], "meteor")).toBeNull();
    expect(pickWildwoodDraftCard(draftState(), "knight", [], "meteor", rng)).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });

  it("rejects a second pick of the same offered card from the updated state", () => {
    const first = pickWildwoodDraftCard(draftState(), "knight", [], "slash", () => 0.5);
    expect(first).not.toBeNull();
    const second = pickWildwoodDraftCard(first!.state, "knight", [first!.card], "slash", () => 0.5);
    expect(second).toBeNull();
  });

  it("finishes the draft with an owned card and rejects excess picks without rerolling", () => {
    const rng = vi.fn(() => 0.5);
    const deck = Array.from({ length: DRAFT_ROUNDS - 1 }, (_, index) => card(`draft-${index}`));
    const state = draftState();
    const picked = pickWildwoodDraftCard(state, "knight", deck, "slash", rng)!;
    expect(picked.state.draftChoices).toEqual([]);
    expect(picked.card).toEqual(state.draftChoices[0]);
    expect(picked.card).not.toBe(state.draftChoices[0]);
    picked.card.descriptionLines.push("modified");
    expect(state.draftChoices[0].descriptionLines).not.toContain("modified");
    expect(pickWildwoodDraftCard(state, "knight", [...deck, picked.card], "slash", rng)).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });
});

describe("Wildwood phase transitions", () => {
  it("rejects boss preparation from battle or an unfinished draft without spending RNG", () => {
    const rng = vi.fn(() => 0.5);
    expect(prepareNextWildwoodBoss(draftState(), DRAFT_ROUNDS - 1, rng)).toBeNull();
    expect(prepareNextWildwoodBoss(draftState({ phase: "battle" }), DRAFT_ROUNDS, rng)).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });

  it("does not enter battle from an unprepared reward after victory", () => {
    const afterVictory = enterWildwoodReward(
      draftState({
        phase: "battle",
        currentBossId: "forge-golem",
        currentCombatTraitIds: ["tempered"],
      }),
    );
    expect(afterVictory).toMatchObject({ phase: "reward", currentCombatTraitIds: [] });
    expect(enterWildwoodBattle(afterVictory!)).toBeNull();
  });

  it("prepares a fresh battle from victory while consuming only the two world trait draws", () => {
    const rngState = createRunRngState(42);
    const victorious = draftState({
      phase: "battle",
      currentBossId: "forge-golem",
      currentCombatTraitIds: ["tempered"],
    });
    const reward = enterWildwoodReward(victorious)!;
    const prepared = prepareNextWildwoodBoss(reward, 5, createRunStateRng(rngState, "world"))!;
    expect(prepared.bossId).toBe("iron-bear");
    expect(prepared.state.currentCombatTraitIds).toHaveLength(1);
    expect(prepared.state.currentRewardTraitIds).toHaveLength(1);
    expect(enterWildwoodBattle(prepared.state)).toEqual({ ...prepared.state, phase: "battle" });
    expect(rngState.counters).toEqual({ world: 2, rewards: 0, destinations: 0, events: 0, shops: 0 });
    expect(victorious.phase).toBe("battle");
  });

  it("enters removal only from reward and skip only from removal", () => {
    expect(enterWildwoodRemoval(draftState({ phase: "reward" }))?.phase).toBe("removal");
    expect(enterWildwoodRemoval(draftState({ phase: "battle" }))).toBeNull();
    expect(canSkipWildwoodRemoval(draftState({ phase: "removal" }))).toBe(true);
    expect(canSkipWildwoodRemoval(draftState({ phase: "reward" }))).toBe(false);
  });

  it("rejects invalid, non-integer, and undersized-deck removals", () => {
    const removal = draftState({ phase: "removal" });
    const deck = Array.from({ length: 8 }, (_, index) => card(`card-${index}`));
    expect(removeWildwoodCard(removal, deck, 0)).toHaveLength(7);
    expect(removeWildwoodCard(removal, deck, 8)).toBeNull();
    expect(removeWildwoodCard(removal, deck, 1.5)).toBeNull();
    expect(removeWildwoodCard(removal, deck.slice(0, 7), 0)).toBeNull();
    expect(removeWildwoodCard(draftState({ phase: "reward" }), deck, 0)).toBeNull();
  });
});
