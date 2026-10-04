import { describe, expect, it } from "vitest";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";
import { cardLibrary, trinketById } from "@/lib/game-data";
import type { Destination } from "@/lib/routing";
import {
  restorePendingRewardBundle,
  serializePendingReward,
} from "@/lib/active-run-session/pending-reward-persistence";
import { createEmptyRewardState } from "@/lib/active-run-session";

const slash = cardLibrary.find((card) => card.id === "slash")!;

describe("pending reward persistence", () => {
  it("round-trips gear identity, affixes, selection, currencies and victory routing", () => {
    const instance = createGearInstance(gearDefinitions["ruby-ring-basic"], [{ id: "flat-burn", value: 1 }]);
    const reward = {
      ...createEmptyRewardState(["Campfire"]),
      rewardType: "gear" as const,
      choices: [instance],
      gold: 12,
      materials: { ...createEmptyRewardState().materials, herbs: 3 },
      selectedId: instance.instanceId,
      selectedBossId: "frostwarden",
      lastVictoryEnemyType: "elite" as const,
      lastVictoryContentSystem: "campaign" as const,
    };
    const persisted = serializePendingReward(reward)!;
    expect(persisted.destinations).not.toBe(reward.destinations);
    expect(restorePendingRewardBundle(JSON.parse(JSON.stringify(persisted))).rewardState).toEqual(reward);
  });

  it.each(["card", "boon", "trinket"] as const)(
    "restores %s choices from the catalog while dropping unknown and prototype IDs",
    (rewardType) => {
      const reward =
        rewardType === "card"
          ? { ...createEmptyRewardState(), rewardType, choices: [slash] }
          : { ...createEmptyRewardState(), rewardType, choices: [trinketById["bone-charm"]!] };
      const persisted = serializePendingReward(reward)!;
      if (persisted.rewardType === "gear") throw new Error("Expected catalog reward");
      expect(persisted.rewardType).toBe(rewardType);
      persisted.choiceIds = ["toString", "constructor", "missing-choice", reward.choices[0]!.id];
      expect(restorePendingRewardBundle(persisted).rewardState).toEqual(reward);
    },
  );

  it.each(["card", "gear"] as const)("drops an empty %s reward with a stale selection", (rewardType) => {
    const reward = { ...createEmptyRewardState(), rewardType, choices: [], selectedId: "slash" };
    expect(serializePendingReward(reward)).toBeNull();
    const persisted = serializePendingReward({ ...reward, gold: 1 })!;
    persisted.gold = 0;
    expect(restorePendingRewardBundle(persisted).rewardState).toBeNull();
  });

  it.each(["card", "gear"] as const)("retains material-only %s rewards without resolvable choices", (rewardType) => {
    const reward = {
      ...createEmptyRewardState(),
      rewardType,
      choices: [],
      materials: { ...createEmptyRewardState().materials, wood: 2 },
    };
    const persisted = serializePendingReward(reward)!;
    if (persisted.rewardType === "card") persisted.choiceIds = ["missing-choice"];
    expect(restorePendingRewardBundle(persisted)).toEqual({ rewardState: reward, companionRewardCards: null });
  });

  it("retains valid exit destinations after filtering corrupt labels, even with no reward choices", () => {
    const persisted = serializePendingReward(createEmptyRewardState(["Campfire"]))!;
    persisted.destinations = ["Campfire", "Not A Real Destination", "Mystery"] as Destination[];
    expect(restorePendingRewardBundle(persisted).rewardState).toEqual(createEmptyRewardState(["Campfire", "Mystery"]));
  });

  it("preserves ordered mixed bonuses and excluded cards while dropping unknown bonus IDs", () => {
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    const excluded = cardLibrary.find((card) => card.excludeFromOfferPool)!;
    const bonuses = [slash, companion, excluded];
    const reward = { ...createEmptyRewardState(), choices: [excluded], gold: 8 };
    const persisted = serializePendingReward(reward, bonuses)!;
    expect(persisted.companionChoiceIds).toEqual(bonuses.map((card) => card.id));
    persisted.companionChoiceIds.splice(1, 0, "missing-bonus");
    expect(restorePendingRewardBundle(persisted)).toEqual({ rewardState: reward, companionRewardCards: bonuses });
  });

  it("keeps bonus cards reachable when the primary reward has no resolvable choices", () => {
    const persisted = serializePendingReward({ ...createEmptyRewardState(), rewardType: "trinket", choices: [] }, [
      slash,
    ])!;
    if (persisted.rewardType !== "trinket") throw new Error("Expected trinket reward");
    persisted.choiceIds = ["missing-trinket"];
    expect(restorePendingRewardBundle(persisted)).toEqual({
      rewardState: createEmptyRewardState(),
      companionRewardCards: [slash],
    });
  });

  it("drops a bundle when neither its primary nor bonus choices can be restored", () => {
    const persisted = serializePendingReward({ ...createEmptyRewardState(), choices: [slash] }, [slash])!;
    if (persisted.rewardType !== "card") throw new Error("Expected card reward");
    persisted.choiceIds = [];
    persisted.companionChoiceIds = ["missing-bonus"];
    expect(restorePendingRewardBundle(persisted)).toEqual({ rewardState: null, companionRewardCards: null });
  });
});
