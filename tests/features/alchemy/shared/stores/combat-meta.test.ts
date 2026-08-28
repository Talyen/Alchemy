import { beforeEach, describe, expect, it } from "vitest";
import { deriveCombatMeta } from "@/features/alchemy/shared/stores/combat-meta";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";

beforeEach(() => resetAllTestStores());

describe("deriveCombatMeta", () => {
  it("derives combat manifests and active trinkets from one command draft", () => {
    const combatMeta = dispatchRunSessionCommand((draft) => {
      draft.run.activeRun.runBoons = ["bone-charm"];
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId] = "meteorite";
      draft.runProfile.effects.flatPhysicalDamage = 2;
      return deriveCombatMeta(draft);
    });

    expect(combatMeta.activeTrinketIds).toEqual(["bone-charm", "meteorite"]);
    expect(combatMeta.talentEffects.flatPhysicalDamage).toBe(2);
    expect(combatMeta.gearEffects).toBeDefined();
  });

  it("matches direct gear and talent manifest computations", () => {
    const { combatMeta, expectedTalent, expectedGear } = dispatchRunSessionCommand((draft) => {
      draft.runProfile.effects.flatPhysicalDamage = 3;
      return {
        combatMeta: deriveCombatMeta(draft),
        expectedTalent: mergeIntoManifest(
          computeTalentEffects(draft.runProfile.unlockedTalents),
          draft.runProfile.effects,
        ),
        expectedGear: computeGearManifest(
          draft.run.activeRun.characterId,
          flattenGearInventories(draft.gear.inventories),
          draft.gear.loadouts,
        ),
      };
    });

    expect(combatMeta.talentEffects).toEqual(expectedTalent);
    expect(combatMeta.gearEffects).toEqual(expectedGear);
  });
});
