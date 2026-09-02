import { describe, it, expect } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";
import { defaultBattleState } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";
import { baseActiveRunInput, makeWildwoodDraft } from "../../fixtures/active-run";
import { DRAFT_ROUNDS } from "@/lib/game-constants";

const tombstoned = { id: "antivenom-potion" };
const live = { id: "slash" };

function parseActiveRunData(overrides: Record<string, unknown> = {}) {
  const result = ActiveRunDataSchema.safeParse({ ...baseActiveRunInput(), ...overrides });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

describe("ActiveRunDataSchema normalize", () => {
  it("passes through an active campaign run and nulls foreign content fields", () => {
    const result = parseActiveRunData();
    expect(result.contentSystemType).toBe("campaign");
    expect(result.runPlayerHealth).toBe(30);
    expect(result.labyrinthMap).toBeNull();
    expect(result.labyrinthPendingNode).toBeNull();
    expect(result.wildwoodDraft).toBeNull();
    expect(result.starterDraftChoices).toBeNull();
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

  it("handles null activeCombat", () => {
    const result = parseActiveRunData();
    expect(result.activeCombat).toBeNull();
  });

  it("nulls wildwood draft outside wildwood runs", () => {
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      wildwoodDraft: makeWildwoodDraft(),
    });
    expect(result.wildwoodDraft).toBeNull();
  });

  it("nulls starter draft choices on wildwood runs", () => {
    const result = parseActiveRunData({
      contentSystemType: "wildwood",
      wildwoodDraft: makeWildwoodDraft(),
      starterDraftChoices: [live],
    });
    expect(result.starterDraftChoices).toBeNull();
  });

  it("filters tombstoned starter draft choices instead of nulling them on campaign runs", () => {
    const result = parseActiveRunData({
      contentSystemType: "campaign",
      starterDraftChoices: [live, tombstoned],
    });
    expect(result.starterDraftChoices?.map((card) => card.id)).toEqual(["slash"]);
  });

  it("strips tombstoned card ids from every persisted card collection", () => {
    const fullDeck = Array.from({ length: DRAFT_ROUNDS }, () => ({ id: "slash" }));
    const result = parseActiveRunData({
      contentSystemType: "wildwood",
      runDeck: fullDeck,
      starterDraftChoices: [tombstoned],
      wildwoodDraft: makeWildwoodDraft({ draftChoices: [tombstoned] }),
      activeCombat: {
        battleState: {
          ...defaultBattleState(),
          deck: [live, tombstoned],
          hand: [tombstoned],
          discard: [live],
          exhausted: [tombstoned],
          wishOptions: [tombstoned],
          wishQueue: [[live], [tombstoned, live]],
        },
      },
      shopState: { cards: [live, tombstoned] },
      alchemistState: { potions: [tombstoned] },
      mysteryVisit: { eventId: "e", cardChoices: [tombstoned], chosenCardId: "slash" },
    });

    expect(result.runDeck.map((card) => card.id)).toEqual(Array(DRAFT_ROUNDS).fill("slash"));
    expect(result.starterDraftChoices).toBeNull();
    expect(result.wildwoodDraft?.draftChoices).toEqual([]);

    const state = result.activeCombat!.battleState;
    expect(state.deck.map((card) => card.id)).toEqual(["slash"]);
    expect(state.hand).toEqual([]);
    expect(state.discard.map((card) => card.id)).toEqual(["slash"]);
    expect(state.exhausted).toEqual([]);
    expect(state.wishOptions).toEqual([]);
    expect(state.wishQueue).toEqual([[live], [live]]);

    expect(result.shopState?.cards.map((card) => card.id)).toEqual(["slash"]);
    expect(result.alchemistState?.potions).toEqual([]);
    expect(result.mysteryVisit?.cardChoices).toEqual([]);
  });

  it("remaps shop purchasedSlotKeys when a tombstoned offering is dropped", () => {
    const result = parseActiveRunData({
      shopState: {
        cards: [tombstoned, live],
        purchasedSlotKeys: ["slash-1"],
        refreshesLeft: 1,
      },
      alchemistState: {
        potions: [tombstoned, live],
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
        battleState: { ...defaultBattleState(), wishQueue: [[live], "junk", 7] },
      },
    });
    expect(result.activeCombat?.battleState.wishQueue).toEqual([[live]]);
  });

  it("nulls mysteryVisit when currentScreen is not mystery", () => {
    const result = parseActiveRunData({
      currentScreen: "shop",
      mysteryVisit: { eventId: "cardless-shrine", cardChoices: [live] },
    });
    expect(result.mysteryVisit).toBeNull();
  });

  it("keeps mysteryVisit when currentScreen is mystery", () => {
    const result = parseActiveRunData({
      currentScreen: "mystery",
      mysteryVisit: { eventId: "cardless-shrine", cardChoices: [live] },
    });
    expect(result.mysteryVisit).toMatchObject({ eventId: "cardless-shrine" });
    expect(result.mysteryVisit?.cardChoices?.map((card) => card.id)).toEqual(["slash"]);
  });

  it("keeps mysteryVisit when currentScreen is unset so resume can infer mystery", () => {
    const result = parseActiveRunData({
      mysteryVisit: { eventId: "cardless-shrine", cardChoices: [live] },
    });
    expect(result.currentScreen).toBeNull();
    expect(result.mysteryVisit).toMatchObject({ eventId: "cardless-shrine" });
  });
});
