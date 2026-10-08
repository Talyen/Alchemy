import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, expect, it } from "vitest";
import { parseActiveRun, toActiveRunData } from "@/lib/active-run-session";
import { ActiveRunDataSchema } from "@/lib/validation";
import { makeActiveRunData } from "../../features/alchemy/shared/stores/active-run-data-fixture";
import { cardById, cardLibrary } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import { makeMinimalActiveRunInput, makeWildwoodDraft } from "../../fixtures/active-run";

describe("parseActiveRun", () => {
  it.each(["toString", "constructor", "__proto__"])(
    "drops inherited catalog key %s instead of crashing resume",
    (id) => {
      const result = parseActiveRun(makeMinimalActiveRunInput({ runDeck: [cardById.slash!, { id }] }));
      expect(result?.runDeck.map((card) => card.id)).toEqual(["slash"]);
    },
  );

  it.each(["campaign", "wildwood"])(
    "recovers incomplete card content across %s save locations",
    (contentSystemType) => {
      const card = cardById["molten-bulwark"]!;
      const damaged = {
        ...card,
        effects: [{ kind: "player-status", status: "block", amount: 9 }, { kind: "invalid" }],
        descriptionLines: ["Gain 9 Block", "Restore 2 Health"],
        corrupted: true,
        corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
      };
      const visits = [
        savedActivityFixture("shop", { cards: [damaged], refreshesLeft: 1, purchasedSlotKeys: [] }),
        savedActivityFixture("alchemist", { potions: [damaged], refreshesLeft: 1, purchasedSlotKeys: [] }),
        savedActivityFixture("mystery", {
          event: findMysteryEvent("ancient-altar")!,
          chosenChoice: null,
          cardChoices: [damaged],
          grantedTrinketIds: [],
          grantedGear: [],
          chosenCardId: null,
        }),
        savedActivityFixture("corruption", {
          originalCard: damaged,
          corruptedCard: damaged,
          transformed: false,
          delta: 1,
        }),
      ];
      for (const activity of visits) {
        const raw = makeMinimalActiveRunInput({
          contentSystemType,
          runDeck: [damaged, { ...card, id: "retired-card" }],
          starterDraftChoices: [damaged],
          wildwoodDraft: contentSystemType === "wildwood" ? makeWildwoodDraft({ draftChoices: [damaged] }) : null,
          activity,
        });
        const parsed = parseActiveRun(JSON.parse(JSON.stringify(ActiveRunDataSchema.parse(raw))));
        expect(parsed?.runDeck).toEqual([card]);
        expect(
          contentSystemType === "wildwood" ? parsed?.wildwoodDraft?.draftChoices : parsed?.starterDraftChoices,
        ).toEqual([card]);
        if (!parsed) throw new Error("Expected playable run");
        const visit = parsed.activity;
        if (visit.kind === "shop") expect(visit.data.cards).toEqual([card]);
        if (visit.kind === "alchemist") expect(visit.data.potions).toEqual([card]);
        if (visit.kind === "mystery") expect(visit.data?.cardChoices).toEqual([card]);
        if (visit.kind === "corruption")
          expect(visit.data).toEqual({ originalCard: card, corruptedCard: card, transformed: false, delta: 1 });
        expect(parseActiveRun(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
      }
    },
  );

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
      activity: savedActivityFixture("shop", {
        cards: [{ id: card.id } as unknown as typeof card],
        removeUsed: false,
        refreshesLeft: 1,
        freeRefreshUsed: false,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      }),
    });

    const parsed = parseActiveRun(rawData);
    expect(parsed).not.toBeNull();
    expect(parsed?.runDeck[0]?.title).toBe(card.title);
    expect(parsed?.starterDraftChoices?.[0]?.title).toBe(card.title);
    expect(savedActivityData(parsed, "shop")?.cards[0]?.title).toBe(card.title);
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
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("ancient-altar")!,
        chosenChoice: null,
        cardChoices: [{ id: card.id } as unknown as typeof card],
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
      }),
    });

    const parsed = ActiveRunDataSchema.safeParse(rawData);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const hydrated = toActiveRunData(parsed.data);
    expect(hydrated.wildwoodDraft?.draftChoices[0]?.title).toBe(card.title);
    expect(savedActivityData(hydrated, "mystery")?.cardChoices?.[0]?.title).toBe(card.title);
  });
});
