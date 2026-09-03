import { describe, it, expect } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { baseActiveRunInput, makeWildwoodDraft } from "../../fixtures/active-run";
import { createRunRngState } from "@/lib/rng";
import { isTombstonedCardId } from "@/lib/validation/migration/tombstoned-content-ids";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";

const tombstoned = { id: "antivenom-potion" };
const tombstoned2 = { id: "imp-companion" };

function makeRng() {
  return createRunRngState(() => 0.42);
}

function parseActiveRunData(overrides: Record<string, unknown>) {
  const result = ActiveRunDataSchema.safeParse({ ...baseActiveRunInput(), ...overrides });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

describe("ActiveRunDataSchema empty-choice repair", () => {
  it("re-offers starter draft choices for campaign when all tombstoned", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      characterId: "wildcard",
      contentSystemType: "campaign",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstoned, tombstoned2, tombstoned],
    });
    const repaired = result.starterDraftChoices!;
    expect(repaired.length).toBe(3);
    for (const card of repaired) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.rewards).toBeGreaterThan(0);

    expect(result.rng.counters.world).toBe(0);
    expect(result.rng.counters.events).toBe(0);
  });

  it("re-offers starter draft choices for labyrinth", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      characterId: "wildcard",
      contentSystemType: "labyrinth",
      labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    });
    const repaired = result.starterDraftChoices!;
    expect(repaired.length).toBe(3);
    expect(result.rng.counters.rewards).toBeGreaterThan(0);
  });

  it("does not re-offer starter draft when already complete", () => {
    const rng = makeRng();
    const fullDeck = Array.from({ length: DRAFT_ROUNDS }, () => ({ id: "slash" }));
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      runDeck: fullDeck,
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    });
    expect(result.starterDraftChoices).toEqual([]);
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("does not re-offer when original was null", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      runDeck: [{ id: "slash" }],
      rng,
      starterDraftChoices: null,
    });
    expect(result.starterDraftChoices).toBeNull();
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("re-offers wildwood draft choices when all tombstoned", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      characterId: "knight",
      contentSystemType: "wildwood",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      wildwoodDraft: makeWildwoodDraft({ draftChoices: [tombstoned, tombstoned, tombstoned] }),
    });
    const draft = result.wildwoodDraft!;
    expect(draft.draftChoices.length).toBe(3);
    for (const card of draft.draftChoices) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.world).toBeGreaterThan(0);
    expect(result.rng.counters.rewards).toBe(0);
  });

  it("does not re-offer wildwood when phase is not draft", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      contentSystemType: "wildwood",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      wildwoodDraft: makeWildwoodDraft({
        phase: "reward",
        draftChoices: [tombstoned, tombstoned, tombstoned],
      }),
    });
    expect(result.wildwoodDraft?.draftChoices).toEqual([]);
    expect(result.rng.counters.world).toBe(0);
  });

  it("re-offers mystery cardChoices when all tombstoned and awaiting pick", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
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
    });
    const visit = result.mysteryVisit!;
    expect(visit.cardChoices!.length).toBe(3);
    for (const card of visit.cardChoices!) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.events).toBeGreaterThan(0);
  });

  it("does not re-offer mystery when already picked", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
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
    });
    expect(result.mysteryVisit?.cardChoices).toEqual([]);
    expect(result.rng.counters.events).toBe(0);
  });

  it("re-offered cards are drawn from the live offerable pool", () => {
    const poolIds = new Set(getOfferableCardPool().map((card) => card.id));
    const rng = makeRng();
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      runDeck: [],
      rng,
      starterDraftChoices: [tombstoned, tombstoned, tombstoned],
    });
    for (const card of result.starterDraftChoices!) expect(poolIds.has(card.id)).toBe(true);
  });
});
