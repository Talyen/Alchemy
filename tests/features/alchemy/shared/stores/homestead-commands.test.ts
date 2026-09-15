import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import {
  addMaterialsToStockpile,
  awardMaterialsDuringRun,
  constructBuilding,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { emptyInventory } from "@/lib/homestead/inventory";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("homestead write commands", () => {
  it("awardMaterialsDuringRun writes the stockpile and the run tally; stockpile grants skip the tally", () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      awardMaterialsDuringRun(draft, { ...emptyInventory(), wood: 2 });
      addMaterialsToStockpile(draft, { ...emptyInventory(), wood: 1, iron: 3 });
    });

    expect(readRunProfile().materialInventory.wood).toBe(3);
    expect(readRunProfile().materialInventory.iron).toBe(3);
    expect(readActiveRun().runMaterialsEarned.wood).toBe(2);
    expect(readActiveRun().runMaterialsEarned.iron).toBe(0);
  });

  it("failed construction writes nothing and leaves live health untouched", () => {
    const healthBefore = dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      const built = constructBuilding(draft, "blacksmiths-forge");
      expect(built).toBe(false);
      return draft.run.activeRun.runMaxHealth;
    });

    expect(readRunProfile().materialInventory).toEqual(emptyInventory());
    expect(readActiveRun().runMaxHealth).toBe(healthBefore);
  });
});
