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
      activeCombat: {
        battleState: {
          ...defaultBattleState(),
          deck: [{ ...mixed, uid: 1 }],
          hand: [{ ...mixed, uid: 2 }],
          pendingHandCards: [{ ...mixed, uid: 3 }],
          discard: [{ ...mixed, uid: 4 }],
          exhausted: [{ ...mixed, uid: 5 }],
        },
      },
    });
    expect(result.runDeck.map((card) => card.id)).toEqual([mixed.id]);
    expect(result.runDeck[0]?.effects).toEqual(mixed.effects);
    const battle = result.activeCombat!.battleState;
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
    expect(result.activeCombat).toBeNull();
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
      activeCombat: {
        battleState: { ...defaultBattleState() },
        activeLabyrinthModifiers: ["mod1"],
        activeLabyrinthRewardModifiers: ["mod2"],
      },
    });
    expect(result.activeCombat).not.toBeNull();
    expect(result.activeCombat?.activeLabyrinthModifiers).toEqual([]);
    expect(result.activeCombat?.activeLabyrinthRewardModifiers).toEqual([]);
  });

  it("keeps labyrinth modifiers for labyrinth mode", () => {
    const result = parseActiveRunData({
      contentSystemType: "labyrinth",
      labyrinthMap: generateLabyrinthMap(createSeededRng(1)),
      activeCombat: {
        battleState: { ...defaultBattleState() },
        activeLabyrinthModifiers: ["septic"],
        activeLabyrinthRewardModifiers: ["generous"],
      },
    });
    expect(result.activeCombat?.activeLabyrinthModifiers).toEqual(["septic"]);
    expect(result.activeCombat?.activeLabyrinthRewardModifiers).toEqual(["generous"]);
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
      activeCombat: {
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
      },
      shopState: { cards: [liveCard, tombstonedCard] },
      alchemistState: { potions: [tombstonedCard] },
      mysteryVisit: { event: testMysteryEvent, cardChoices: [tombstonedCard], chosenCardId: "slash" },
    });

    expect(result.runDeck.map((card) => card.id)).toEqual(Array(DRAFT_ROUNDS).fill("slash"));
    expect(result.starterDraftChoices).toBeNull();
    expect(result.wildwoodDraft?.draftChoices).toEqual([]);

    const state = result.activeCombat!.battleState;
    expect(state.deck.map((card) => card.id)).toEqual(["slash"]);
    expect(state.hand).toEqual([]);
    expect(state.pendingHandCards.map((card) => card.id)).toEqual([liveCard.id]);
    expect(state.discard.map((card) => card.id)).toEqual(["slash"]);
    expect(state.exhausted).toEqual([]);
    expect(state.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
    expect(state.wishQueue.map((queue) => queue.map((card) => card.id))).toEqual([[liveCard.id]]);

    expect(result.shopState?.cards.map((card) => card.id)).toEqual(["slash"]);
    expect(result.alchemistState?.potions).toEqual([]);
    expect(result.mysteryVisit?.cardChoices).toEqual([]);
  });

  it("remaps shop purchasedSlotKeys when a tombstonedCard offering is dropped", () => {
    const result = parseActiveRunData({
      shopState: {
        cards: [tombstonedCard, liveCard],
        purchasedSlotKeys: ["slash-1"],
        refreshesLeft: 1,
      },
      alchemistState: {
        potions: [tombstonedCard, liveCard],
        purchasedSlotKeys: ["slash-1"],
        mixUsed: false,
      },
    });

    expect(result.shopState?.cards.map((card) => card.id)).toEqual(["slash"]);
    expect(result.shopState?.purchasedSlotKeys).toEqual(["slash-0"]);
    expect(result.alchemistState?.potions.map((card) => card.id)).toEqual(["slash"]);
    expect(result.alchemistState?.purchasedSlotKeys).toEqual(["slash-0"]);
  });

  it("drops malformed wishQueue entries instead of aborting the parse", () => {
    const result = parseActiveRunData({
      activeCombat: {
        battleState: { ...defaultBattleState(), wishOptions: [null], wishQueue: [[liveCard], "junk", 7] },
      },
    });
    expect(result.activeCombat?.battleState.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
    expect(result.activeCombat?.battleState.wishQueue).toEqual([]);
  });

  it("closes an emptied Wish prompt when no valid queued choice remains", () => {
    const result = parseActiveRunData({
      activeCombat: {
        battleState: { ...defaultBattleState(), wishOptions: [null], wishQueue: [[{ id: 42 }]] },
      },
    });
    expect(result.activeCombat?.battleState.wishOptions).toBeNull();
    expect(result.activeCombat?.battleState.wishQueue).toEqual([]);
  });

  it("preserves purchased slots when a malformed shop card is removed", () => {
    const result = parseActiveRunData({
      shopState: { cards: [null, liveCard], purchasedSlotKeys: ["slash-1"] },
      alchemistState: { potions: [{ id: 42 }, liveCard], purchasedSlotKeys: ["slash-1"] },
    });
    expect(result.shopState?.cards.map((card) => card.id)).toEqual(["slash"]);
    expect(result.shopState?.purchasedSlotKeys).toEqual(["slash-0"]);
    expect(result.alchemistState?.potions.map((card) => card.id)).toEqual(["slash"]);
    expect(result.alchemistState?.purchasedSlotKeys).toEqual(["slash-0"]);
  });

  it("preserves activeCombat when battle scalars are corrupt", () => {
    const result = parseActiveRunData({
      activeCombat: {
        battleState: { ...defaultBattleState(), mana: "four", gold: -5, turn: 0 },
      },
    });
    expect(result.activeCombat).not.toBeNull();
    expect(result.activeCombat?.battleState.mana).toBe(0);
    expect(result.activeCombat?.battleState.gold).toBe(0);
    expect(result.activeCombat?.battleState.turn).toBe(1);
  });

  it.each(["mystery", null] as const)("preserves the saved Mystery offer for resume from %s", (currentScreen) => {
    const result = parseActiveRunData({
      currentScreen,
      mysteryVisit: { event: testMysteryEvent, cardChoices: [liveCard] },
    });
    expect(result.mysteryVisit?.event).toEqual(testMysteryEvent);
    expect(result.mysteryVisit?.cardChoices?.map((card) => card.id)).toEqual([liveCard.id]);
  });

  it("nulls mysteryVisit when currentScreen is not mystery", () => {
    const result = parseActiveRunData({
      currentScreen: "shop",
      mysteryVisit: { event: testMysteryEvent, cardChoices: [liveCard] },
    });
    expect(result.mysteryVisit).toBeNull();
  });
});

it("preserves an active Wish and queued choices until the active choice is resolved", () => {
  const result = parseActiveRunData({
    activeCombat: {
      battleState: {
        ...defaultBattleState(),
        wishOptions: [liveCard, tombstonedCard],
        wishQueue: [[tombstonedCard], [liveCard]],
      },
    },
  });
  const state = result.activeCombat!.battleState;
  expect(state.wishOptions?.map((card) => card.id)).toEqual([liveCard.id]);
  expect(state.wishQueue.map((queue) => queue.map((card) => card.id))).toEqual([[liveCard.id]]);
});
