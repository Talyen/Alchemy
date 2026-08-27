import { beforeEach, describe, expect, it } from "vitest";
import { applyRewardSelection } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import type { GearInstance } from "@/lib/gear";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunSession } from "../../../../helpers/run-domain-store-test";

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

    expect(readGearState().ownedTrinketIds).toContain("bone-charm");
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "trinket", trinketId: "bone-charm" }]);
    expect(readActiveRun().runBoons).not.toContain("bone-charm");
  });

  it("records gear rewards", () => {
    dispatchRunSessionCommand((draft) => {
      applyRewardSelection({ choice: armor, type: "gear", draft });
    });

    expect(readGearState().inventories.knight).toContainEqual(armor);
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance: armor }]);
  });

  it("does not record boon rewards", () => {
    dispatchRunSessionCommand((draft) => {
      applyRewardSelection({ choice: { id: "bone-charm" }, type: "boon", draft });
    });

    expect(readActiveRun().runBoons).toEqual(["bone-charm"]);
    expect(readActiveRun().runObtainedItems).toEqual([]);
  });
});
