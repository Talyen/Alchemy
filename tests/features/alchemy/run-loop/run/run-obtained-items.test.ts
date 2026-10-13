import { beforeEach, describe, expect, it } from "vitest";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import type { GearInstance } from "@/lib/gear";
import { trinketLibrary } from "@/lib/game-data";
import { mutateRunForTest, resetAllTestStores, setRunSession } from "../../../../helpers/run-domain-store-test";
import { applyRewardSelection } from "@/features/alchemy/run-loop/run/reward-commands";
import { defaultGameSession } from "@/app/application-session";
const armor: GearInstance = {
  instanceId: "reward-armor",
  definitionId: "leather-armor-basic",
  affixes: [],
};
const boneCharm = trinketLibrary.find((trinket) => trinket.id === "bone-charm")!;

describe("applyRewardSelection obtained-item recap", () => {
  beforeEach(() => {
    resetAllTestStores();
    setRunSession({ hasActiveRun: true });
  });

  it("records permanent trinket rewards", () => {
    mutateRunForTest((draft) => {
      applyRewardSelection({ reward: { rewardType: "trinket", choice: boneCharm }, draft });
    });

    expect(readGearState(defaultGameSession).ownedTrinketIds).toContain("bone-charm");
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "trinket", trinketId: "bone-charm" }]);
    expect(readActiveRun(defaultGameSession).runBoons).not.toContain("bone-charm");
  });

  it("records gear rewards", () => {
    mutateRunForTest((draft) => {
      applyRewardSelection({ reward: { rewardType: "gear", choice: armor }, draft });
    });

    expect(readGearState(defaultGameSession).inventories.knight).toContainEqual(armor);
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance: armor }]);
  });

  it("does not record boon rewards", () => {
    mutateRunForTest((draft) => {
      applyRewardSelection({ reward: { rewardType: "boon", choice: boneCharm }, draft });
    });

    expect(readActiveRun(defaultGameSession).runBoons).toEqual(["bone-charm"]);
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([]);
  });
});
