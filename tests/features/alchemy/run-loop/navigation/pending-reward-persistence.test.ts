import { describe, expect, it } from "vitest";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";
import { cardLibrary, getCardKeywords, trinketLibrary } from "@/lib/game-data";
import type { Destination } from "@/lib/routing";
import {
  restorePendingReward,
  restorePendingRewardBundle,
  serializePendingReward,
} from "@/lib/active-run-session/pending-reward-persistence";
import { createEmptyRewardState } from "@/lib/active-run-session";

describe("pending reward persistence", () => {
  it("round-trips gear reward choices with affixes intact", () => {
    const instance = createGearInstance(gearDefinitions["ruby-ring-basic"], [
      { id: "flat-burn", value: 1 },
      { id: "flat-freeze", value: 1 },
    ]);
    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "gear" as const,
      choices: [instance],
      gold: 12,
      selectedId: instance.instanceId,
      lastVictoryEnemyType: "elite" as const,
      lastVictoryContentSystem: "campaign" as const,
    };

    const persisted = serializePendingReward(rewardState);
    expect(persisted).toEqual({
      rewardType: "gear",
      gearChoices: [instance],
      companionChoiceIds: [],
      selectedId: instance.instanceId,
      gold: 12,
      materials: rewardState.materials,
      destinations: [],
      selectedBossId: null,
      lastVictoryEnemyType: "elite",
      lastVictoryContentSystem: "campaign",
    });

    const restored = restorePendingReward(persisted!);
    expect(restored).toEqual(rewardState);
  });

  it("restores trinket rewardType from persisted saves", () => {
    const parsed = restorePendingReward({
      rewardType: "trinket",
      choiceIds: ["bone-charm"],
      companionChoiceIds: [],
      selectedId: null,
      gold: 0,
      materials: { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 },
      destinations: [],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(parsed?.rewardType).toBe("trinket");
    expect(parsed?.choices).toHaveLength(1);
  });

  it("round-trips a run-scoped boon reward distinctly", () => {
    const entry = trinketLibrary.find((trinket) => trinket.id === "bone-charm");
    expect(entry).toBeDefined();
    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "boon" as const,
      choices: [entry!],
    };
    const persisted = serializePendingReward(rewardState);
    const boon = restorePendingReward(persisted!);
    expect(persisted?.rewardType).toBe("boon");
    expect(boon?.rewardType).toBe("boon");
    expect(boon?.choices).toEqual([entry]);
  });

  it("filters invalid destination labels on restore", () => {
    const restored = restorePendingReward({
      rewardType: "trinket",
      choiceIds: ["bone-charm"],
      companionChoiceIds: [],
      selectedId: null,
      gold: 0,
      materials: { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 },
      destinations: ["Campfire", "Not A Real Destination", "Mystery"] as Destination[],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(restored?.destinations).toEqual(["Campfire", "Mystery"]);
  });

  it.each(["companion", "archery", "wish", "nature"] as const)(
    "round-trips %s bonus choices alongside the primary reward",
    (theme) => {
      const bonuses = cardLibrary
        .filter((card) =>
          theme === "companion"
            ? card.effects.some((effect) => effect.kind === "summon-companion")
            : getCardKeywords(card).includes(theme) &&
              !card.effects.some((effect) => effect.kind === "summon-companion"),
        )
        .slice(0, 3);
      expect(bonuses.length).toBeGreaterThan(0);
      const primary = cardLibrary.find((card) => card.id === "slash")!;
      const rewardState = {
        ...createEmptyRewardState(),
        choices: [primary],
        gold: 8,
      };
      const persisted = serializePendingReward(rewardState, bonuses)!;

      expect(persisted.companionChoiceIds).toEqual(bonuses.map((card) => card.id));
      const restored = restorePendingRewardBundle(persisted);
      expect(restored.rewardState).toEqual(rewardState);
      expect(restored.companionRewardCards).toEqual(bonuses);
    },
  );

  it("preserves mixed bonus choices in order while dropping unknown IDs", () => {
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    const plain = cardLibrary.find((card) => card.id === "slash")!;
    const excluded = cardLibrary.find((card) => card.excludeFromOfferPool)!;
    const bonuses = [plain, companion, excluded];
    const rewardState = { ...createEmptyRewardState(), choices: [plain] };
    const persisted = serializePendingReward(rewardState, bonuses)!;
    persisted.companionChoiceIds.splice(1, 0, "no-such-bonus-card");

    const restored = restorePendingRewardBundle(persisted);
    expect(restored.rewardState).toEqual(rewardState);
    expect(restored.companionRewardCards).toEqual(bonuses);
  });

  it.each([{ ids: [] }, { ids: ["no-such-bonus-card"] }])("restores no bonus for IDs $ids", ({ ids }) => {
    const rewardState = {
      ...createEmptyRewardState(),
      choices: [cardLibrary.find((card) => card.id === "slash")!],
    };
    const persisted = { ...serializePendingReward(rewardState)!, companionChoiceIds: ids };
    expect(restorePendingRewardBundle(persisted)).toEqual({ rewardState, companionRewardCards: null });
    expect(restorePendingRewardBundle({ ...persisted, rewardType: "card", choiceIds: [] })).toEqual({
      rewardState: null,
      companionRewardCards: null,
    });
  });

  it("restores cards excluded from the general offer pool", () => {
    const excludedCard = cardLibrary.find((card) => card.excludeFromOfferPool);
    expect(excludedCard).toBeDefined();

    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [excludedCard!],
    };

    const persisted = serializePendingReward(rewardState);
    if (persisted?.rewardType === "card") {
      expect(persisted.choiceIds).toEqual([excludedCard!.id]);
    } else {
      expect.fail("Expected persisted reward to be of type card");
    }

    const restored = restorePendingReward(persisted!);
    expect(restored?.rewardType).toBe("card");
    if (restored?.rewardType === "card") {
      expect(restored.choices[0]?.id).toBe(excludedCard!.id);
      expect(restored.choices[0]?.title).toBe(excludedCard!.title);
    }
  });
});
