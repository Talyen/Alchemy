import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, expect, it } from "vitest";
import { parseActiveRun } from "@/lib/validation";
import { ActiveRunDataSchema } from "@/lib/validation";
import { cardById } from "@/lib/game-data";
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
    expect(parseActiveRun(makeMinimalActiveRunInput({ characterId: undefined }))).toBeNull();
    expect(parseActiveRun(makeMinimalActiveRunInput({ runDeck: undefined }))).toBeNull();
  });

  it("hydrates ID-only cards in the deck, starter choices, and shop", () => {
    const card = cardById.slash!;
    const saved = [{ id: card.id }];
    const parsed = parseActiveRun(
      makeMinimalActiveRunInput({
        runDeck: saved,
        starterDraftChoices: saved,
        activity: savedActivityFixture("shop", { cards: saved, refreshesLeft: 1, purchasedSlotKeys: [] }),
      }),
    );
    expect(parsed?.runDeck).toEqual([card]);
    expect(parsed?.starterDraftChoices).toEqual([card]);
    expect(savedActivityData(parsed, "shop")?.cards).toEqual([card]);
  });

  it("keeps an unstarted deck empty instead of synthesizing cards", () => {
    expect(parseActiveRun(makeMinimalActiveRunInput({ runDeck: [] }))?.runDeck).toEqual([]);
  });
});

it("repairs Wildwood boss and trait IDs without discarding the playable draft", () => {
  const wildwoodDraft = {
    ...makeWildwoodDraft(),
    phase: "battle",
    remainingBossIds: ["forge-golem", "retired-boss"],
    previousBossId: "retired-boss",
    currentBossId: "iron-bear",
    currentCombatTraitIds: ["tempered", "removed-combat-trait"],
    currentRewardTraitIds: ["collector", "removed-reward-trait"],
  };
  const restored = parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "wildwood", wildwoodDraft }));
  expect(restored?.wildwoodDraft).toMatchObject({
    phase: "battle",
    remainingBossIds: ["forge-golem"],
    previousBossId: null,
    currentBossId: "iron-bear",
    currentCombatTraitIds: ["tempered"],
    currentRewardTraitIds: [],
  });
  expect(parseActiveRun(makeMinimalActiveRunInput({ contentSystemType: "wildwood", wildwoodDraft: null }))).toBeNull();
});
