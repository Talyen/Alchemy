import { beforeEach, describe, expect, it } from "vitest";
import { applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import type { GearInstance } from "@/lib/gear";
import { resetAllTestStores, useGearStore } from "../../../../helpers/gameplay-store-test";
import { getRunProgressStoreView, setRunSession } from "../../../../helpers/run-domain-store-test";

const armor: GearInstance = {
  instanceId: "reward-armor",
  definitionId: "leather-armor-basic",
  affixes: [],
};

describe("applyRewardSelection obtained-item recap", () => {
  beforeEach(() => {
    resetAllTestStores();
    setRunSession({ hasActiveRun: true });
  });

  it("records permanent trinket rewards", () => {
    dispatchRunSessionCommand((draft) => {
      applyRewardSelection({ choice: { id: "bone-charm" }, type: "trinket", draft });
    });

    expect(useGearStore.getState().ownedTrinketIds).toContain("bone-charm");
    expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "trinket", trinketId: "bone-charm" }]);
    expect(getRunProgressStoreView().runBoons).not.toContain("bone-charm");
  });

  it("records gear rewards", () => {
    dispatchRunSessionCommand((draft) => {
      applyRewardSelection({ choice: armor, type: "gear", draft });
    });

    expect(useGearStore.getState().inventories.knight).toContainEqual(armor);
    expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "gear", instance: armor }]);
  });

  it("does not record boon rewards", () => {
    dispatchRunSessionCommand((draft) => {
      applyRewardSelection({ choice: { id: "bone-charm" }, type: "boon", draft });
    });

    expect(getRunProgressStoreView().runBoons).toEqual(["bone-charm"]);
    expect(getRunProgressStoreView().runObtainedItems).toEqual([]);
  });
});
