import { describe, it, expect } from "vitest";
import { normalizeActiveRunData } from "@/lib/validation";
import { baseActiveRunInput } from "../../fixtures/active-run";

const baseInput = baseActiveRunInput;

describe("normalizeActiveRunData", () => {
  it("passes through an active campaign run and nulls foreign content fields", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.contentSystemType).toBe("campaign");
    expect(result.runPlayerHealth).toBe(30);
    expect(result.labyrinthMap).toBeNull();
    expect(result.wildwoodDraft).toBeNull();
    expect(result.starterDraftChoices).toBeNull();
  });

  it("keeps labyrinth contentSystemType when labyrinthMap is null", () => {
    const input = { ...baseInput(), contentSystemType: "labyrinth" };
    const result = normalizeActiveRunData(input);
    expect(result.contentSystemType).toBe("labyrinth");
  });

  it("clamps player health to maxHealth", () => {
    const input = { ...baseInput(), runPlayerHealth: 50, runMaxHealth: 30 };
    const result = normalizeActiveRunData(input);
    expect(result.runPlayerHealth).toBe(30);
  });

  it("strips labyrinth modifiers for campaign mode", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "campaign",
      activeCombat: {
        activeLabyrinthModifiers: ["mod1"],
        activeLabyrinthRewardModifiers: ["mod2"],
      },
    };
    const result = normalizeActiveRunData(input);
    expect(result.activeCombat).not.toBeNull();
    if (result.activeCombat) {
      expect((result.activeCombat as Record<string, unknown>).activeLabyrinthModifiers).toEqual([]);
      expect((result.activeCombat as Record<string, unknown>).activeLabyrinthRewardModifiers).toEqual([]);
    }
  });

  it("handles null activeCombat", () => {
    const result = normalizeActiveRunData(baseInput());
    expect(result.activeCombat).toBeNull();
  });

  it("nulls wildwood draft outside wildwood runs", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "campaign",
      wildwoodDraft: { version: 3, phase: "draft" },
    };
    const result = normalizeActiveRunData(input);
    expect(result.wildwoodDraft).toBeNull();
  });

  it("nulls starter draft choices on wildwood runs", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "wildwood",
      starterDraftChoices: [{ id: "slash" }],
    };
    const result = normalizeActiveRunData(input);
    expect(result.starterDraftChoices).toBeNull();
  });

  it("filters tombstoned starter draft choices instead of nulling them on campaign runs", () => {
    const input = {
      ...baseInput(),
      contentSystemType: "campaign",
      starterDraftChoices: [{ id: "slash" }, { id: "antivenom-potion" }],
    };
    const result = normalizeActiveRunData(input);
    expect(result.starterDraftChoices).toEqual([{ id: "slash" }]);
  });

  it("strips tombstoned card ids from every persisted card collection", () => {
    const tombstoned = { id: "antivenom-potion" };
    const live = { id: "slash" };
    const battlePiles = {
      deck: [live, tombstoned],
      hand: [tombstoned],
      discard: [live],
      exhausted: [tombstoned],
      wishOptions: [tombstoned],
      wishQueue: [[live], [tombstoned, live]],
    };
    const input = {
      ...baseInput(),
      contentSystemType: "wildwood",
      runDeck: [live, tombstoned],
      starterDraftChoices: [tombstoned],
      wildwoodDraft: { version: 3, phase: "draft", draftChoices: [tombstoned] },
      activeCombat: { battleState: battlePiles },
      shopState: { cards: [live, tombstoned] },
      alchemistState: { potions: [tombstoned] },
      mysteryVisit: { eventId: "e", cardChoices: [tombstoned] },
    };
    const result = normalizeActiveRunData(input);

    expect(result.runDeck.map((c: { id: string }) => c.id)).toEqual(["slash"]);
    expect(result.starterDraftChoices).toBeNull();
    expect((result.wildwoodDraft as Record<string, unknown>).draftChoices).toEqual([]);

    const combat = result.activeCombat as Record<string, unknown>;
    const state = combat.battleState as Record<string, Array<{ id: string }>>;
    expect(state.deck.map((c) => c.id)).toEqual(["slash"]);
    expect(state.hand).toEqual([]);
    expect(state.discard.map((c) => c.id)).toEqual(["slash"]);
    expect(state.exhausted).toEqual([]);
    expect(state.wishOptions).toEqual([]);
    expect(state.wishQueue).toEqual([[live], [live]]);

    expect((result.shopState as Record<string, unknown>).cards).toEqual([live]);
    expect((result.alchemistState as Record<string, unknown>).potions).toEqual([]);
    expect((result.mysteryVisit as Record<string, unknown>).cardChoices).toEqual([]);
  });

  it("drops malformed wishQueue entries instead of aborting the parse", () => {
    const live = { id: "slash" };
    const input = {
      ...baseInput(),
      activeCombat: { battleState: { wishQueue: [[live], "junk", 7] } },
    };
    const result = normalizeActiveRunData(input);
    const state = (result.activeCombat as Record<string, unknown>).battleState as Record<string, unknown>;
    expect(state.wishQueue).toEqual([[live]]);
  });

  it("nulls mysteryVisit when currentScreen is not mystery", () => {
    const result = normalizeActiveRunData({
      ...baseInput(),
      currentScreen: "shop",
      mysteryVisit: { eventId: "cardless-shrine", cardChoices: [{ id: "slash" }] },
    });
    expect(result.mysteryVisit).toBeNull();
  });

  it("keeps mysteryVisit when currentScreen is mystery", () => {
    const visit = { eventId: "cardless-shrine", cardChoices: [{ id: "slash" }] };
    const result = normalizeActiveRunData({
      ...baseInput(),
      currentScreen: "mystery",
      mysteryVisit: visit,
    });
    expect(result.mysteryVisit).toMatchObject(visit);
  });

  it("keeps mysteryVisit when currentScreen is missing so resume can infer mystery", () => {
    const visit = { eventId: "cardless-shrine", cardChoices: [{ id: "slash" }] };
    const result = normalizeActiveRunData({
      ...baseInput(),
      mysteryVisit: visit,
    });
    expect(result.currentScreen).toBeUndefined();
    expect(result.mysteryVisit).toMatchObject(visit);
  });
});
