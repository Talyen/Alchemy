import { savedActivityFixture, savedActivityData } from "../../fixtures/run-activity";
import { describe, it, expect } from "vitest";
import { ActiveRunDataSchema } from "@/lib/validation";

import { makeMinimalActiveRunInput } from "../../fixtures/active-run";

describe("ActiveRunDataSchema persisted session payloads", () => {
  const run = (overrides: Record<string, unknown> = {}) =>
    makeMinimalActiveRunInput({ runGold: 0, selectedDifficulty: null, labyrinthMap: null, ...overrides });

  it("parses a valid run", () => {
    const result = ActiveRunDataSchema.safeParse(run());
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual([]);
    }
  });

  it("preserves valid destination offer history when one saved counter is invalid", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({ destinationRoundsSinceOffered: { Campfire: 3, Mystery: "broken" } }),
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.destinationRoundsSinceOffered).toEqual({ Campfire: 3 });
  });

  it("keeps valid run cards when one saved card is malformed", () => {
    const result = ActiveRunDataSchema.safeParse(run({ runDeck: [{ id: "slash" }, { id: 42 }, { id: "block" }] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.runDeck.map((card) => card.id)).toEqual(["slash", "block"]);
  });

  it("still rejects a run without a deck array", () => {
    expect(ActiveRunDataSchema.safeParse(run({ runDeck: "broken" })).success).toBe(false);
  });

  it("preserves the offered destination and rejects missing or unknown activities", () => {
    const activity = savedActivityFixture("destination", {
      destinations: ["Campfire"],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(ActiveRunDataSchema.parse(run({ activity })).activity).toEqual(activity);
    expect(ActiveRunDataSchema.safeParse(run({ activity: { kind: "not-a-screen" } })).success).toBe(false);
    expect(ActiveRunDataSchema.safeParse(run({ activity: undefined })).success).toBe(false);
  });

  it("normalizes encountered run enemy IDs", () => {
    const result = ActiveRunDataSchema.safeParse(run({ encounteredRunEnemyIds: ["goblin", "goblin", 1] }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encounteredRunEnemyIds).toEqual(["goblin"]);
    }
  });

  it("preserves run deck array for unstarted run", () => {
    const legacyDeck = [
      {
        id: "slash",
        title: "Slash",
        descriptionLines: [],
        art: "",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      },
    ];
    const result = ActiveRunDataSchema.safeParse(run({ runDeck: legacyDeck }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runDeck.length).toBe(1);
    }
  });

  it("parses persisted shop slices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        runGold: 50,
        roomsEncountered: 2,
        destinationIndexInAct: 1,
        activity: savedActivityFixture("trinket-shop", {
          trinketIds: ["lucky-clover"],
          refreshesLeft: 2,
          firstPurchaseUsed: true,
        }),
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (result.success) {
      expect(savedActivityData(result.data, "trinket-shop")?.trinketIds).toEqual(["lucky-clover"]);
      expect(savedActivityData(result.data, "trinket-shop")?.refreshesLeft).toBe(2);
    }
  });

  it("preserves pending gear rewards with empty choices", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        activity: savedActivityFixture("rewards", {
          rewardType: "gear",
          gearChoices: [],
          selectedId: null,
          gold: 0,
          materials: { wood: 0, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 },
          destinations: [],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        }),
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activity.kind).toBe("rewards");
      if (result.data.activity.kind === "rewards") {
        expect(result.data.activity.data.rewardType).toBe("gear");
        if (result.data.activity.data.rewardType === "gear") {
          expect(result.data.activity.data.gearChoices).toEqual([]);
        }
      }
    }
  });

  it("keeps Wildwood rewards on interruptedFlow without nested draft reward fields", () => {
    const result = ActiveRunDataSchema.safeParse(
      run({
        contentSystemType: "wildwood",
        wildwoodDraft: {
          phase: "reward",
          draftChoices: [],
          remainingBossIds: [],
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
        activity: savedActivityFixture("rewards", {
          rewardType: "card",
          choiceIds: ["slash", "bash", "block"],
          companionChoiceIds: [],
          selectedId: null,
          gold: 0,
          materials: {},
          destinations: [],
          selectedBossId: null,
          lastVictoryEnemyType: "boss",
          lastVictoryContentSystem: "wildwood",
        }),
      }),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.wildwoodDraft).toMatchObject({ phase: "reward" });
    expect(result.data.wildwoodDraft).not.toHaveProperty("rewardType");
    expect(result.data.activity).toEqual(
      expect.objectContaining({
        kind: "rewards",
        data: expect.objectContaining({ rewardType: "card", choiceIds: ["slash", "bash", "block"] }),
      }),
    );
  });
});
