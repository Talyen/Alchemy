import { describe, expect, it } from "vitest";
import { createGearInstance } from "@/lib/gear";
import { gearDefinitions } from "@/lib/gear/definitions";
import { restorePendingReward, serializePendingReward } from "@/lib/active-run-session/pending-reward-persistence";
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

  it("remaps legacy boon rewardType to trinket when parsing saves", () => {
    const parsed = restorePendingReward({
      rewardType: "trinket",
      choiceIds: ["bone-charm"],
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
});
