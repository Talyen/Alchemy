import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, it, expect } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { createMixedPotion } from "@/lib/alchemist";
import { cardById } from "@/lib/game-data";
import { defaultBattleState } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/rng";
import {
  baseActiveRunInput,
  liveCard,
  makeWildwoodDraft,
  parseActiveRunData,
  tombstonedCard,
} from "../../fixtures/active-run";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

const testMysteryEvent = {
  id: "cardless-shrine",
  title: "Cardless Shrine",
  art: "",
  narrative: "Test",
  choices: [{ label: "Leave", effects: [] }],
};

describe("ActiveRunDataSchema normalize", () => {
  it("preserves generated Mixed Potions in the run and every battle pile on resume", () => {
    const mixed = createMixedPotion(cardById["health-potion"]!, cardById["mana-potion"]!);
    const result = parseActiveRunData({
      runDeck: [mixed, tombstonedCard],
      activity: savedActivityFixture("battle", {
        battleState: {
          ...defaultBattleState(),
          deck: [{ ...mixed, uid: 1 }],
          hand: [{ ...mixed, uid: 2 }],
          pendingHandCards: [{ ...mixed, uid: 3 }],
          discard: [{ ...mixed, uid: 4 }],
          exhausted: [{ ...mixed, uid: 5 }],
        },
      }),
    });
    expect(result.runDeck.map((card) => card.id)).toEqual([mixed.id]);
    expect(result.runDeck[0]?.effects).toEqual(mixed.effects);
    const battle = savedActivityData(result, "battle")!.battleState;
    for (const pile of [battle.deck, battle.hand, battle.pendingHandCards, battle.discard, battle.exhausted]) {
      expect(pile).toHaveLength(1);
      expect(pile[0]?.id).toBe(mixed.id);
      expect(pile[0]?.effects).toEqual(mixed.effects);
    }
  });

  it("passes through an active campaign run and nulls foreign content fields", () => {
    const result = parseActiveRunData();
    expect(result.contentSystemType).toBe("campaign");
    expect(result.runPlayerHealth).toBe(30);
    expect(result.labyrinthMap).toBeNull();
    expect(result.labyrinthPendingNode).toBeNull();
    expect(result.wildwoodDraft).toBeNull();
    expect(result.starterDraftChoices).toBeNull();
    expect(savedActivityData(result, "battle")).toBeNull();
  });

  it("drops a labyrinth run whose map is missing", () => {
    const result = ActiveRunDataSchema.safeParse({
      ...baseActiveRunInput(),
      contentSystemType: "labyrinth",
      labyrinthMap: null,
    });
    expect(result.success).toBe(false);
  });

  it("clamps player health to maxHealth", () => {
    const result = parseActiveRunData({ runPlayerHealth: 50, runMaxHealth: 30 });
    expect(result.runPlayerHealth).toBe(30);
    expect(result.runMetaMaxHealth).toBe(30);
  });

  it("strips labyrinth modifiers for campaign mode", () => {
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState() },
        activeLabyrinthModifiers: ["mod1"],
        activeLabyrinthRewardModifiers: ["mod2"],
      }),
    });
    expect(savedActivityData(result, "battle")).not.toBeNull();
    expect(result.activeLabyrinthModifiers).toEqual([]);
    expect(result.activeLabyrinthRewardModifiers).toEqual([]);
  });

  it("keeps labyrinth modifiers for labyrinth mode", () => {
    const result = parseActiveRunData({
      contentSystemType: "labyrinth",
      activeLabyrinthModifiers: ["septic"],
      activeLabyrinthRewardModifiers: ["generous"],
      labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState() },
        activeLabyrinthModifiers: ["septic"],
        activeLabyrinthRewardModifiers: ["generous"],
      }),
    });
    expect(result.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(result.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("nulls starter draft choices on wildwood runs", () => {
    const result = parseActiveRunData({
      contentSystemType: "wildwood",
      wildwoodDraft: makeWildwoodDraft(),
      starterDraftChoices: [liveCard],
    });
    expect(result.starterDraftChoices).toBeNull();
  });

  it("filters tombstonedCard starter draft choices instead of nulling them on campaign runs", () => {
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      starterDraftChoices: [liveCard, tombstonedCard],
    });
    expect(result.starterDraftChoices?.map((card) => card.id)).toEqual(["slash"]);
  });

  it("strips tombstonedCard card ids from every persisted card collection", () => {
    const fullDeck = Array.from({ length: DRAFT_ROUNDS }, () => ({ id: "slash" }));
    const result = parseActiveRunData({
      contentSystemType: "wildwood",
      runDeck: fullDeck,
      starterDraftChoices: [tombstonedCard],
      wildwoodDraft: makeWildwoodDraft({ draftChoices: [tombstonedCard] }),
      activity: savedActivityFixture("battle", {
        battleState: {
          ...defaultBattleState(),
          deck: [liveCard, tombstonedCard],
          hand: [tombstonedCard],
          pendingHandCards: [liveCard, tombstonedCard],
          discard: [liveCard],
          exhausted: [tombstonedCard],
          wishOptions: [tombstonedCard],
          wishQueue: [[liveCard], [tombstonedCard, liveCard]],
        },
      }),
    });

    expect(result.runDeck.map((card) => card.id)).toEqual(Array(DRAFT_ROUNDS).fill("slash"));
    expect(result.starterDraftChoices).toBeNull();
    expect(result.wildwoodDraft?.draftChoices).toEqual([]);

    const state = savedActivityData(result, "battle")!.battleState;
    expect(state.deck.map((card) => card.id)).toEqual(["slash"]);
    expect(state.hand).toEqual([]);
    expect(state.pendingHandCards.map((card) => card.id)).toEqual([liveCard.id]);
    expect(state.discard.map((card) => card.id)).toEqual(["slash"]);
    expect(state.exhausted).toEqual([]);
    expect(state.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
    expect(state.wishQueue.map((queue) => queue.map((card) => card.id))).toEqual([[liveCard.id]]);
  });
  it.each(["shop", "alchemist"] as const)(
    "remaps shop purchasedSlotKeys when a tombstonedCard offering is dropped (%s)",
    (kind) => {
      const result = parseActiveRunData({
        activity: savedActivityFixture(kind, {
          [kind === "shop" ? "cards" : "potions"]: [tombstonedCard, liveCard],
          purchasedSlotKeys: ["slash-1"],
          refreshesLeft: 1,
        }),
      });
      if (result.activity.kind !== "shop" && result.activity.kind !== "alchemist") throw new Error("Expected shelf");
      const cards = result.activity.kind === "shop" ? result.activity.data.cards : result.activity.data.potions;
      expect(cards.map((card) => card.id)).toEqual(["slash"]);
      expect(result.activity.data.purchasedSlotKeys).toEqual(["slash-0"]);
    },
  );

  it("drops malformed wishQueue entries instead of aborting the parse", () => {
    const result = parseActiveRunData({
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState(), wishOptions: [null], wishQueue: [[liveCard], "junk", 7] },
      }),
    });
    expect(savedActivityData(result, "battle")?.battleState.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
    expect(savedActivityData(result, "battle")?.battleState.wishQueue).toEqual([]);
  });

  it("closes an emptied Wish prompt when no valid queued choice remains", () => {
    const result = parseActiveRunData({
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState(), wishOptions: [null], wishQueue: [[{ id: 42 }]] },
      }),
    });
    expect(savedActivityData(result, "battle")?.battleState.wishOptions).toBeNull();
    expect(savedActivityData(result, "battle")?.battleState.wishQueue).toEqual([]);
  });

  it.each(["shop", "alchemist"] as const)(
    "preserves purchased slots when a malformed shop card is removed (%s)",
    (kind) => {
      const result = parseActiveRunData({
        activity: savedActivityFixture(kind, {
          [kind === "shop" ? "cards" : "potions"]: [null, liveCard],
          purchasedSlotKeys: ["slash-1"],
          refreshesLeft: 1,
        }),
      });
      if (result.activity.kind !== "shop" && result.activity.kind !== "alchemist") throw new Error("Expected shelf");
      const cards = result.activity.kind === "shop" ? result.activity.data.cards : result.activity.data.potions;
      expect(cards.map((card) => card.id)).toEqual(["slash"]);
      expect(result.activity.data.purchasedSlotKeys).toEqual(["slash-0"]);
    },
  );

  it("preserves activeCombat when battle scalars are corrupt", () => {
    const result = parseActiveRunData({
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState(), mana: "four", gold: -5, turn: 0 },
      }),
    });
    expect(savedActivityData(result, "battle")).not.toBeNull();
    expect(savedActivityData(result, "battle")?.battleState.mana).toBe(0);
    expect(savedActivityData(result, "battle")?.battleState.gold).toBe(0);
    expect(savedActivityData(result, "battle")?.battleState.turn).toBe(1);
  });

  it("preserves the saved Mystery offer for resume", () => {
    const result = parseActiveRunData({
      activity: savedActivityFixture("mystery", { event: testMysteryEvent, cardChoices: [liveCard] }),
    });
    expect(savedActivityData(result, "mystery")?.event).toEqual(testMysteryEvent);
    expect(savedActivityData(result, "mystery")?.cardChoices?.map((card) => card.id)).toEqual([liveCard.id]);
  });

  it("nulls mysteryVisit when currentScreen is not mystery", () => {
    const result = parseActiveRunData({ activity: savedActivityFixture("shop") });
    expect(savedActivityData(result, "mystery")).toBeNull();
  });
});

it("preserves an active Wish and queued choices until the active choice is resolved", () => {
  const result = parseActiveRunData({
    activity: savedActivityFixture("battle", {
      battleState: {
        ...defaultBattleState(),
        wishOptions: [liveCard, tombstonedCard],
        wishQueue: [[tombstonedCard], [liveCard]],
      },
    }),
  });
  const state = savedActivityData(result, "battle")!.battleState;
  expect(state.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
  expect(state.wishQueue.map((queue) => queue.map((card) => card.id))).toEqual([[liveCard.id]]);
});
