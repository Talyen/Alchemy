import { beforeEach, describe, expect, it } from "vitest";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readActiveRun, readRunProfile, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import {
  addMaterialsToStockpile,
  awardMaterialsDuringRun,
  bondCompanion,
  constructBuilding,
  setDiscoveredCardIds,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { SaveDataSchema } from "@/lib/validation/save-schemas/save-data";
import { awardRunEndMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

describe("homestead write commands", () => {
  it("awardMaterialsDuringRun writes the stockpile and the run tally; stockpile grants skip the tally", () => {
    dispatchGameplayCommand(
      (draft) => {
        setHasActiveRun(draft, true);
        awardMaterialsDuringRun(draft, { ...emptyInventory(), wood: 2 });
        addMaterialsToStockpile(draft, { ...emptyInventory(), wood: 1, iron: 3 });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(3);
    expect(readRunProfile(defaultGameSession).materialInventory.iron).toBe(3);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(2);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.iron).toBe(0);
  });

  it("failed construction writes nothing and leaves live health untouched", () => {
    const healthBefore = dispatchGameplayCommand(
      (draft) => {
        setHasActiveRun(draft, true);
        const built = constructBuilding(draft, "blacksmiths-forge");
        expect(built).toBe(false);
        return acceptCommand(draft.run.activeRun.runMaxHealth);
      },
      undefined,
      defaultGameSession,
    );

    expect(readRunProfile(defaultGameSession).materialInventory).toEqual(emptyInventory());
    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(healthBefore);
  });

  it("rejects bonding an undiscovered companion without changing progression or food", () => {
    dispatchGameplayCommand(
      (draft) => {
        addMaterialsToStockpile(draft, { ...emptyInventory(), food: 50 });
        setDiscoveredCardIds(draft, ["bear-companion"]);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const revision = readRunRevision(defaultGameSession);

    expect(
      dispatchGameplayCommand((draft) => acceptCommand(bondCompanion(draft, "wolf")), undefined, defaultGameSession),
    ).toBe(false);
    expect(readRunRevision(defaultGameSession)).toBe(revision);
    expect(readRunProfile(defaultGameSession).materialInventory.food).toBe(50);
    expect(readRunProfile(defaultGameSession).bondedCompanions.wolf).toBe(0);
    expect(readRunProfile(defaultGameSession).effects.companionBondLevels.wolf).toBe(0);
  });

  it("bonds a discovered companion through the command", () => {
    dispatchGameplayCommand(
      (draft) => {
        addMaterialsToStockpile(draft, { ...emptyInventory(), food: 50 });
        setDiscoveredCardIds(draft, ["wolf-companion"]);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    expect(
      dispatchGameplayCommand((draft) => acceptCommand(bondCompanion(draft, "wolf")), undefined, defaultGameSession),
    ).toBe(true);
    expect(readRunProfile(defaultGameSession).materialInventory.food).toBe(30);
    expect(readRunProfile(defaultGameSession).bondedCompanions.wolf).toBe(1);
    expect(readRunProfile(defaultGameSession).effects.companionBondLevels.wolf).toBe(1);
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
    dispatchGameplayCommand(
      (draft) => {
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

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
  });

  it("pays Wildwood Materials and Gold with the usual Homestead rules", () => {
    dispatchGameplayCommand(
      (draft) => {
        draft.run.activeRun.contentSystemType = CONTENT_SYSTEMS.WILDWOOD;
        draft.run.activeRun.roomsEncountered = 3;
        draft.runProfile.effects = {
          ...defaultHomesteadEffects,
          endRunStonePerRoom: 4,
          endRunGoldPerRoom: 4,
          endRunWishPerRoom: 4,
        };
        const before = draft.runProfile.gold;
        expect(awardRunEndMaterials(draft)).toEqual({ ...emptyInventory(), stone: 12, gems: 4 });
        expect(draft.runProfile.gold - before).toBe(20);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
  });
});
