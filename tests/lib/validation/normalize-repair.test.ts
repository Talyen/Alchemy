import { describe, it, expect } from "vitest";
import { normalizeActiveRunData } from "@/lib/validation";
import { baseActiveRunInput } from "../../fixtures/active-run";
import { createRunRngState } from "@/lib/run-rng";
import { isTombstonedCardId } from "@/lib/validation/migration/tombstoned-content-ids";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

const tombstoned = { id: "antivenom-potion" };
const tombstoned2 = { id: "imp-companion" };

function makeRng() {
  return createRunRngState(() => 0.42);
}

describe("normalizeActiveRunData empty-choice repair", () => {
  it("re-offers starter draft choices for campaign when all tombstoned", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      characterId: "wildcard",
      contentSystemType: "campaign",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstoned, tombstoned2, tombstoned],
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const repaired = result.starterDraftChoices as Array<{ id: string }>;
    expect(Array.isArray(repaired)).toBe(true);
    expect(repaired.length).toBe(3);
    for (const card of repaired) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.rewards).toBeGreaterThan(0);
    // Not drawn from wildwood or events streams
    expect(result.rng.counters.world).toBe(0);
    expect(result.rng.counters.events).toBe(0);
  });

  it("re-offers starter draft choices for labyrinth", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      characterId: "wildcard",
      contentSystemType: "labyrinth",
      labyrinthMap: { floors: [], nodes: {}, currentFloor: 0 } as unknown as never,
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const repaired = result.starterDraftChoices as Array<{ id: string }>;
    expect(repaired.length).toBe(3);
    expect(result.rng.counters.rewards).toBeGreaterThan(0);
  });

  it("does not re-offer starter draft when already complete", () => {
    const rng = makeRng();
    const fullDeck = Array.from({ length: DRAFT_ROUNDS }, () => ({ id: "slash" }));
    const input = {
      ...baseActiveRunInput(),
      contentSystemType: "campaign",
      runDeck: fullDeck,
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const repaired = result.starterDraftChoices as Array<{ id: string }>;
    expect(repaired).toEqual([]);
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("does not re-offer when original was null", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      contentSystemType: "campaign",
      runDeck: [{ id: "slash" }],
      rng,
      starterDraftChoices: null,
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    expect(result.starterDraftChoices).toBeNull();
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("re-offers wildwood draft choices when all tombstoned", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      characterId: "knight",
      contentSystemType: "wildwood",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      wildwoodDraft: {
        phase: "draft",
        draftChoices: [tombstoned, tombstoned, tombstoned],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const draft = result.wildwoodDraft as { draftChoices: Array<{ id: string }> };
    expect(draft.draftChoices.length).toBe(3);
    for (const card of draft.draftChoices) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.world).toBeGreaterThan(0);
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("does not re-offer wildwood when phase is not draft", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      contentSystemType: "wildwood",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      wildwoodDraft: {
        phase: "reward",
        draftChoices: [tombstoned, tombstoned, tombstoned],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const draft = result.wildwoodDraft as { draftChoices: Array<{ id: string }> };
    expect(draft.draftChoices).toEqual([]);
    expect(result.rng.counters.world).toBe(0);
  });

  it("re-offers mystery cardChoices when all tombstoned and awaiting pick", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      currentScreen: "mystery",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      mysteryVisit: {
        eventId: "ancient-altar",
        chosenChoice: null,
        cardChoices: [tombstoned, tombstoned, tombstoned],
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
        resolvedTrinketIds: [],
      },
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const visit = result.mysteryVisit as { cardChoices: Array<{ id: string }> };
    expect(visit.cardChoices.length).toBe(3);
    for (const card of visit.cardChoices) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.events).toBeGreaterThan(0);
  });

  it("does not re-offer mystery when already picked", () => {
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      currentScreen: "mystery",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      mysteryVisit: {
        eventId: "ancient-altar",
        chosenChoice: null,
        cardChoices: [tombstoned, tombstoned, tombstoned],
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: "slash",
        resolvedTrinketIds: [],
      },
    };
    const result = normalizeActiveRunData(input) as typeof input & { rng: typeof rng };
    const visit = result.mysteryVisit as { cardChoices: Array<{ id: string }> };
    expect(visit.cardChoices).toEqual([]);
    expect(result.rng.counters.events).toBe(0);
  });

  it("re-offered cards are drawn from the live offerable pool", () => {
    const poolIds = new Set(getOfferableCardPool().map((c) => c.id));
    const rng = makeRng();
    const input = {
      ...baseActiveRunInput(),
      contentSystemType: "campaign",
      runDeck: [],
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    };
    const result = normalizeActiveRunData(input);
    const repaired = result.starterDraftChoices as Array<{ id: string }>;
    for (const card of repaired) expect(poolIds.has(card.id)).toBe(true);
  });
});
