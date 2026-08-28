import { describe, expect, it } from "vitest";
import {
  canCompleteWildwoodDraft,
  canOfferWildwoodRemoval,
  canPrepareNextWildwoodBoss,
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
  withWildwoodModifier,
  type WildwoodDraftState,
} from "@/lib/content-systems/wildwood/gauntlet";
import { WILDWOOD_BOSS_IDS } from "@/lib/content-systems/wildwood/bosses";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import type { BestiaryEntry, BattleCard } from "@/lib/game-data";
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
  it("creates a shuffled bag containing every boss exactly once", () => {
    const bag = createWildwoodBossBag(() => 0.5);
    expect([...bag].sort()).toEqual([...WILDWOOD_BOSS_IDS].sort());
  });

  it("refills the bag and prevents a boundary repeat", () => {
    const result = drawWildwoodBoss([], "iron-bear", () => 0);
    expect(result.bossId).not.toBe("iron-bear");
    expect(result.remainingBossIds).toHaveLength(WILDWOOD_BOSS_IDS.length - 1);
  });

  it("consumes the next boss from an existing bag", () => {
    const result = drawWildwoodBoss(["forge-golem", "iron-bear"], "frostwarden", () => 0.5);
    expect(result).toEqual({ bossId: "forge-golem", remainingBossIds: ["iron-bear"] });
  });

  it("offers removal only for decks with at least eight cards", () => {
    expect(canOfferWildwoodRemoval(7)).toBe(false);
    expect(canOfferWildwoodRemoval(8)).toBe(true);
  });

  it("appends a shared combat trait without mutating the boss", () => {
    const boss: BestiaryEntry = {
      id: "boss",
      title: "Boss",
      subtitle: "",
      descriptionLines: [],
      art: "",
      enemyType: "boss",
      traits: [{ id: "normal", title: "Normal", description: "Normal trait" }],
      attackEffects: [],
    };

    const result = withWildwoodModifier(boss, "tempered");

    expect(result).not.toBe(boss);
    expect(result.traits).toEqual([
      boss.traits[0],
      { id: "tempered", title: "Tempered", description: "Gains 1 Forge each turn" },
    ]);
    expect(boss.traits).toHaveLength(1);
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

  it("rejects completion from the wrong phase or undersized deck", () => {
    expect(canCompleteWildwoodDraft(draftState(), DRAFT_ROUNDS - 1)).toBe(false);
    expect(canCompleteWildwoodDraft(draftState({ phase: "reward" }), DRAFT_ROUNDS)).toBe(false);
    expect(canCompleteWildwoodDraft(draftState(), DRAFT_ROUNDS)).toBe(true);
  });
});

describe("Wildwood phase transitions", () => {
  it("prepares the next boss from a completed draft and from reward or removal", () => {
    expect(canPrepareNextWildwoodBoss(draftState(), DRAFT_ROUNDS - 1)).toBe(false);
    expect(canPrepareNextWildwoodBoss(draftState({ phase: "battle" }), DRAFT_ROUNDS)).toBe(false);
    expect(canPrepareNextWildwoodBoss(draftState(), DRAFT_ROUNDS)).toBe(true);
    expect(canPrepareNextWildwoodBoss(draftState({ phase: "reward" }), 5)).toBe(true);
    expect(canPrepareNextWildwoodBoss(draftState({ phase: "removal" }), 8)).toBe(true);
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
