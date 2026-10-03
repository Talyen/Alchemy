import { describe, expect, it } from "vitest";
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

function countingRng() {
  let draws = 0;
  return {
    get draws() {
      return draws;
    },
    rng: () => {
      draws += 1;
      return 0.5;
    },
  };
}

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
    const source = countingRng();
    const draw = drawWildwoodBoss([], bag[0]!, source.rng);
    expect(draw.bossId).toBe(bag[1]);
    expect(draw.remainingBossIds).toEqual([bag[0], ...bag.slice(2)]);
    expect([draw.bossId, ...draw.remainingBossIds].sort()).toEqual([...WILDWOOD_BOSS_IDS].sort());
    expect(source.draws).toBe(WILDWOOD_BOSS_IDS.length - 1);
  });

  it("consumes the next boss from an existing bag", () => {
    const result = drawWildwoodBoss(["forge-golem", "iron-bear"], "frostwarden", () => 0.5);
    expect(result).toEqual({ bossId: "forge-golem", remainingBossIds: ["iron-bear"] });
  });
});

describe("Wildwood draft picks", () => {
  it("accepts an offered card and refreshes choices below the draft limit", () => {
    const source = countingRng();
    const pick = pickWildwoodDraftCard(draftState(), "knight", [], "slash", source.rng);
    expect(pick?.card.id).toBe("slash");
    expect(pick?.state.draftChoices.length).toBeGreaterThan(0);
    expect(source.draws).toBeGreaterThan(0);
  });

  it("rejects a non-offered card without drawing RNG", () => {
    const source = countingRng();
    expect(offeredWildwoodDraftCard(draftState(), [], "meteor")).toBeNull();
    expect(pickWildwoodDraftCard(draftState(), "knight", [], "meteor", source.rng)).toBeNull();
    expect(source.draws).toBe(0);
  });

  it("rejects a second pick of the same offered card from the updated state", () => {
    const first = pickWildwoodDraftCard(draftState(), "knight", [], "slash", () => 0.5);
    expect(first).not.toBeNull();
    const second = pickWildwoodDraftCard(first!.state, "knight", [first!.card], "slash", () => 0.5);
    expect(second).toBeNull();
  });

  it("rejects excess picks once the draft is full without drawing RNG", () => {
    const source = countingRng();
    const fullDeck = Array.from({ length: DRAFT_ROUNDS }, (_, index) => card(`draft-${index}`));
    expect(pickWildwoodDraftCard(draftState(), "knight", fullDeck, "slash", source.rng)).toBeNull();
    expect(source.draws).toBe(0);
  });
});

describe("Wildwood phase transitions", () => {
  it("rejects boss preparation from battle or an unfinished draft without spending RNG", () => {
    const source = countingRng();
    expect(prepareNextWildwoodBoss(draftState(), DRAFT_ROUNDS - 1, source.rng)).toBeNull();
    expect(prepareNextWildwoodBoss(draftState({ phase: "battle" }), DRAFT_ROUNDS, source.rng)).toBeNull();
    expect(source.draws).toBe(0);
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

  it("enters battle after preparing the next boss from reward", () => {
    const afterVictory = enterWildwoodReward(
      draftState({
        phase: "battle",
        currentBossId: "forge-golem",
        currentCombatTraitIds: ["tempered"],
      }),
    );
    const prepared = prepareNextWildwoodBoss(afterVictory!, 5, () => 0);
    expect(prepared).not.toBeNull();
    expect(enterWildwoodBattle(prepared!.state)?.phase).toBe("battle");
  });

  it("uses one world draw for each trait when the boss bag is already filled", () => {
    const rngState = createRunRngState(42);
    const prepared = prepareNextWildwoodBoss(draftState({ phase: "reward" }), 5, createRunStateRng(rngState, "world"));

    expect(prepared?.bossId).toBe("iron-bear");
    expect(prepared?.state.currentCombatTraitIds).toHaveLength(1);
    expect(prepared?.state.currentRewardTraitIds).toHaveLength(1);
    expect(rngState.counters.world).toBe(2);
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
