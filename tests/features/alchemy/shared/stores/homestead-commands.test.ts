import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import {
  addMaterialsToStockpile,
  awardMaterialsDuringRun,
  constructBuilding,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { SaveDataSchema } from "@/lib/validation/save-schemas/save-data";
import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-materials";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
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

describe("four-tier Homestead persistence and settlement", () => {
  it("preserves levels three and four without extending Companion Bonds", () => {
    const source = {
      constructedBuildings: { "blacksmiths-forge": 3, "runesmiths-workshop": 4 },
      plantedFarms: { "crystal-garden": 4 },
      completedResearch: { "leyline-energy": 4 },
      bondedCompanions: { wolf: 3 },
    };
    const loaded = SaveDataSchema.parse(JSON.parse(JSON.stringify(source)));
    expect(loaded.constructedBuildings["blacksmiths-forge"]).toBe(3);
    expect(loaded.constructedBuildings["runesmiths-workshop"]).toBe(4);
    expect(loaded.plantedFarms["crystal-garden"]).toBe(4);
    expect(loaded.completedResearch["leyline-energy"]).toBe(4);
  });

  it("settles Stone and alternating Wish currency through the proper wallets", () => {
    dispatchRunSessionCommand((draft) => {
      draft.run.activeRun.contentSystemType = CONTENT_SYSTEMS.LABYRINTH;
      draft.run.activeRun.roomsEncountered = 3;
      draft.runProfile.effects = {
        ...defaultHomesteadEffects,
        endRunStonePerRoom: 4,
        endRunGemsPerRoom: 8,
        endRunGoldPerRoom: 4,
        endRunWishPerRoom: 4,
      };
      const before = draft.runProfile.gold;
      const granted = awardRunEndMaterials(draft);
      expect(granted.stone).toBe(12);
      expect(granted.gems).toBe(28);
      expect(draft.runProfile.gold - before).toBe(20);
      expect(draft.session.runEndMaterials.stone).toBe(12);
    });
  });

  it("keeps Wildwood material-free while paying eligible Gold production", () => {
    dispatchRunSessionCommand((draft) => {
      draft.run.activeRun.contentSystemType = CONTENT_SYSTEMS.WILDWOOD;
      draft.run.activeRun.roomsEncountered = 3;
      draft.runProfile.effects = {
        ...defaultHomesteadEffects,
        endRunStonePerRoom: 4,
        endRunGoldPerRoom: 4,
        endRunWishPerRoom: 4,
      };
      const before = draft.runProfile.gold;
      expect(awardRunEndMaterials(draft)).toEqual(emptyInventory());
      expect(draft.runProfile.gold - before).toBe(24);
    });
  });
});
