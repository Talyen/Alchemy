import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, it, expect } from "vitest";
import { makeWildwoodDraft, parseActiveRunData, tombstonedCard, tombstonedCard2 } from "../../fixtures/active-run";
import { createRunRngState, createRunStateRng, createSeededRng, stepRunRng } from "@/lib/rng";
import { TOMBSTONED_CARD_IDS, isTombstonedCardId } from "@/lib/validation/migration/tombstoned-content-ids";
import { ActiveRunDataSchema } from "@/lib/validation";
import { cardById } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { createStarterDraftChoices } from "@/lib/starter-draft";
import { getImmediateDamage, getImmediateDefense } from "@/lib/battle";
import { createCampfirePotionOffers } from "@/lib/alchemist/brewing";
import { doublePotionPotency } from "@/lib/alchemist";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { findMysteryEvent } from "@/lib/mystery";

function makeRng() {
  return createRunRngState(1803886264);
}

describe("ActiveRunDataSchema empty-choice repair", () => {
  it("re-offers starter draft choices for campaign when all tombstoned", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      characterId: "wildcard",
      contentSystemType: "campaign",
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstonedCard, tombstonedCard2, tombstonedCard],
    });
    const repaired = result.starterDraftChoices!;
    expect(repaired.length).toBe(3);
    for (const card of repaired) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.rewards).toBeGreaterThan(0);

    expect(result.rng.counters.world).toBe(0);
    expect(result.rng.counters.events).toBe(0);
    const resumed = ActiveRunDataSchema.parse(JSON.parse(JSON.stringify(result)));
    expect(resumed.starterDraftChoices?.map((card) => card.id)).toEqual(repaired.map((card) => card.id));
    expect(resumed.rng).toEqual(result.rng);
    const choice = repaired[0]!;
    const catalog = cardById[choice.id]!;
    const authored = structuredClone(catalog);
    choice.descriptionLines.push("changed after repair");
    choice.effects.length = 0;
    expect(catalog).toEqual(authored);
  });

  it("repairs Wildcard offers with the same guaranteed starter choices and RNG recipe", () => {
    const rng = makeRng();
    const expectedRng = structuredClone(rng);
    const expected = createStarterDraftChoices([], createRunStateRng(expectedRng, "rewards"));
    const result = parseActiveRunData({
      characterId: "wildcard",
      activity: savedActivityFixture("draft-deck"),
      runDeck: [],
      rng,
      starterDraftChoices: [tombstonedCard],
    });
    expect(result.starterDraftChoices?.map((card) => card.id)).toEqual(expected.map((card) => card.id));
    expect(result.rng).toEqual(expectedRng);
    expect(result.starterDraftChoices?.some((card) => !card.consume && getImmediateDamage(card) > 0)).toBe(true);
    expect(result.starterDraftChoices?.some((card) => !card.consume && getImmediateDefense(card) > 0)).toBe(true);
  });

  it.each(["campaign", "labyrinth"] as const)(
    "repairs an unused %s Alchemist Brew shelf once without changing the other services",
    (mode) => {
      const rng = makeRng();
      const expectedRng = structuredClone(rng);
      const offers = createCampfirePotionOffers(createRunStateRng(expectedRng, "shops"));
      const expected = mode === "labyrinth" ? offers.map(doublePotionPotency) : offers;
      const input = {
        rng,
        contentSystemType: mode,
        ...(mode === "labyrinth"
          ? {
              labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
              activeLabyrinthRewardModifiers: ["strong-spirits"],
            }
          : {}),
        activity: savedActivityFixture("alchemist", {
          potions: [cardById["mana-potion"]!],
          brewOffers: [tombstonedCard],
          brewUsed: false,
          mixUsed: true,
          distillUsed: true,
          refreshesLeft: 2,
          freeRefreshUsed: true,
          firstPurchaseUsed: true,
          purchasedSlotKeys: [],
        }),
      };
      const result = parseActiveRunData(input);
      const shelf = savedActivityData(result, "alchemist")!;
      expect(shelf.brewOffers).toEqual(expected);
      expect(shelf).toMatchObject({ brewUsed: false, mixUsed: true, distillUsed: true, refreshesLeft: 2 });
      expect(result.rng).toEqual(expectedRng);
      const resumed = ActiveRunDataSchema.parse(JSON.parse(JSON.stringify(result)));
      expect(resumed).toEqual(result);
      const used = parseActiveRunData({
        ...input,
        activity: savedActivityFixture("alchemist", { ...shelf, brewOffers: [tombstonedCard], brewUsed: true }),
      });
      expect(savedActivityData(used, "alchemist")!.brewOffers).toEqual([]);
      expect(used.rng).toEqual(rng);
    },
  );

  it("re-offers starter draft choices for labyrinth", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      characterId: "wildcard",
      contentSystemType: "labyrinth",
      labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      starterDraftChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
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
      starterDraftChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
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
      wildwoodDraft: makeWildwoodDraft({ draftChoices: [tombstonedCard, tombstonedCard, tombstonedCard] }),
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
        draftChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
      }),
    });
    expect(result.wildwoodDraft?.draftChoices).toEqual([]);
    expect(result.rng.counters.world).toBe(0);
  });

  it("re-offers mystery cardChoices when all tombstoned and awaiting pick", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("ancient-altar")!,
        chosenChoice: null,
        cardChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
        grantedGear: [],
        chosenCardId: null,
      }),
    });
    const visit = savedActivityData(result, "mystery")!;
    expect(visit.cardChoices!.length).toBe(3);
    for (const card of visit.cardChoices!) expect(isTombstonedCardId(card.id)).toBe(false);
    expect(result.rng.counters.events).toBeGreaterThan(0);
  });

  it("does not re-offer mystery when already picked", () => {
    const rng = makeRng();
    const result = parseActiveRunData({
      runDeck: [{ id: "slash", effects: [] }],
      rng,
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("ancient-altar")!,
        chosenChoice: null,
        cardChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
        grantedGear: [],
        chosenCardId: "slash",
      }),
    });
    expect(savedActivityData(result, "mystery")).toMatchObject({ cardChoices: null, chosenCardId: "slash" });
    expect(result.rng).toEqual(rng);
  });

  it("re-offered cards are drawn from the live offerable pool", () => {
    const poolIds = new Set(getOfferableCardPool().map((card) => card.id));
    const rng = makeRng();
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      runDeck: [],
      rng,
      starterDraftChoices: [tombstonedCard, tombstonedCard, tombstonedCard],
    });
    for (const card of result.starterDraftChoices!) expect(poolIds.has(card.id)).toBe(true);
  });
});

it("tombstoned content ids stays absent from the live catalog", () => {
  expect(TOMBSTONED_CARD_IDS.length).toBeGreaterThan(0);
  for (const id of TOMBSTONED_CARD_IDS) expect(cardById[id]).toBeUndefined();
});

it("ActiveRunDataSchema rng fallback hands a corrupt rng back as mutable run state", () => {
  const result = parseActiveRunData({ rng: "junk" });
  expect(() => stepRunRng(result.rng, "rewards")).not.toThrow();
  expect(result.rng.counters.rewards).toBe(1);
});
