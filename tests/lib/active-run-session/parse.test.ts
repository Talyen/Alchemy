import { describe, expect, it } from "vitest";
import { parseActiveRun, toActiveRunData } from "@/lib/active-run-session";
import { ActiveRunDataSchema } from "@/lib/validation";
import { makeActiveRunData } from "../../features/alchemy/shared/stores/active-run-data-fixture";
import { cardLibrary } from "@/lib/game-data";

describe("parseActiveRun", () => {
  it("returns null for non-object inputs", () => {
    expect(parseActiveRun(null)).toBeNull();
    expect(parseActiveRun(undefined)).toBeNull();
    expect(parseActiveRun("invalid")).toBeNull();
    expect(parseActiveRun(123)).toBeNull();
  });

  it("returns null when validation fails", () => {
    expect(parseActiveRun({})).toBeNull();
    expect(parseActiveRun({ characterId: "knight" })).toBeNull();
  });

  it("successfully parses valid active run data and hydrates card fields", () => {
    const card = cardLibrary[0]!;
    const rawData = makeActiveRunData({
      runDeck: [{ id: card.id } as unknown as typeof card],
      starterDraftChoices: [{ id: card.id } as unknown as typeof card],
      shopState: {
        cards: [{ id: card.id } as unknown as typeof card],
        removeUsed: false,
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      },
      alchemistState: {
        potions: [{ id: card.id } as unknown as typeof card],
        mixUsed: false,
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      },
      corruptionResult: {
        originalCard: { id: card.id } as unknown as typeof card,
        corruptedCard: { id: card.id } as unknown as typeof card,
        transformed: false,
        delta: 1,
      },
    });

    const parsed = parseActiveRun(rawData);
    expect(parsed).not.toBeNull();
    expect(parsed?.runDeck[0]?.title).toBe(card.title);
    expect(parsed?.starterDraftChoices?.[0]?.title).toBe(card.title);
    expect(parsed?.shopState?.cards[0]?.title).toBe(card.title);
    expect(parsed?.alchemistState?.potions[0]?.title).toBe(card.title);
    expect(parsed?.corruptionResult?.originalCard.title).toBe(card.title);
    expect(parsed?.corruptionResult?.corruptedCard.title).toBe(card.title);
  });
});

describe("toActiveRunData", () => {
  it("hydrates nested draft choices and mystery visit cards", () => {
    const card = cardLibrary[0]!;
    const rawData = makeActiveRunData({
      contentSystemType: "wildwood",
      wildwoodDraft: {
        phase: "draft",
        draftChoices: [{ id: card.id } as unknown as typeof card],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
      mysteryVisit: {
        eventId: "ancient-altar",
        chosenChoice: null,
        cardChoices: [{ id: card.id } as unknown as typeof card],
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
        resolvedTrinketIds: [],
      },
    });

    const parsed = ActiveRunDataSchema.safeParse(rawData);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const hydrated = toActiveRunData(parsed.data);
    expect(hydrated.wildwoodDraft?.draftChoices[0]?.title).toBe(card.title);
    expect(hydrated.mysteryVisit?.cardChoices?.[0]?.title).toBe(card.title);
  });
});
