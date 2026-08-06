import { describe, expect, it } from "vitest";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";
import { cardLibrary } from "@/lib/game-data";
import type { Destination } from "@/lib/routing";
import {
  restorePendingReward,
  restorePendingRewardBundle,
  serializePendingReward,
} from "@/lib/active-run-session/pending-reward-persistence";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";

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
      lastVictoryEnemyType: "elite",
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
      materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      destinations: [],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(parsed?.rewardType).toBe("trinket");
    expect(parsed?.choices).toHaveLength(1);
  });

  it("filters invalid destination labels on restore", () => {
    const restored = restorePendingReward({
      rewardType: "trinket",
      choiceIds: ["bone-charm"],
      companionChoiceIds: [],
      selectedId: null,
      gold: 0,
      materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      destinations: ["Campfire", "Not A Real Destination", "Mystery"] as Destination[],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(restored?.destinations).toEqual(["Campfire", "Mystery"]);
  });

  it("round-trips companion choices alongside the primary reward", () => {
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
    const primary = cardLibrary.find((card) => card.id === "slash");
    expect(companion).toBeDefined();
    expect(primary).toBeDefined();

    const rewardState = {
      ...createEmptyRewardState(),
      rewardType: "card" as const,
      choices: [primary!],
      gold: 8,
    };
    const persisted = serializePendingReward(rewardState, [companion!]);

    expect(persisted?.companionChoiceIds).toEqual([companion!.id]);
    const restored = restorePendingRewardBundle(persisted!);
    expect(restored.rewardState?.rewardType).toBe("card");
    if (restored.rewardState?.rewardType === "card") {
      expect(restored.rewardState.choices.map((choice) => choice.id)).toEqual([primary!.id]);
    }
    expect(restored.companionRewardCards?.map((choice) => choice.id)).toEqual([companion!.id]);
  });

  it("keeps companion-only handoffs claimable when the primary reward is already drained", () => {
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
    expect(companion).toBeDefined();

    const persisted = serializePendingReward(createEmptyRewardState(), [companion!]);
    const restored = restorePendingRewardBundle(persisted!);

    expect(restored.rewardState?.choices).toEqual([]);
    expect(restored.companionRewardCards?.map((choice) => choice.id)).toEqual([companion!.id]);
  });
});
