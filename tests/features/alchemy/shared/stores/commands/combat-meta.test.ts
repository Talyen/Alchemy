import { beforeEach, describe, expect, it } from "vitest";
import { deriveCombatMeta, type CombatMeta } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { mutateGameplayForTest, resetAllTestStores } from "../../../../../helpers/run-domain-store-test";

beforeEach(() => resetAllTestStores());

describe("deriveCombatMeta", () => {
  it("derives combat manifests and active trinkets from one command draft", () => {
    const combatMeta: CombatMeta = mutateGameplayForTest((draft) => {
      draft.run.activeRun.runBoons = ["bone-charm"];
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId] = "meteorite";
      draft.runProfile.effects.flatPhysicalDamage = 2;
      return deriveCombatMeta(draft);
    });

    expect(combatMeta.activeTrinketIds).toEqual(["bone-charm", "meteorite"]);
    expect(combatMeta.talentEffects.flatPhysicalDamage).toBe(2);
    expect(combatMeta.gearEffects).toBeDefined();
  });

  it("dedupes a trinket shared by run boons and the equipped loadout", () => {
    const combatMeta = mutateGameplayForTest((draft) => {
      draft.run.activeRun.runBoons = ["bone-charm"];
      draft.gear.equippedTrinkets[draft.run.activeRun.characterId] = "bone-charm";
      return deriveCombatMeta(draft);
    });

    expect(combatMeta.activeTrinketIds).toEqual(["bone-charm"]);
  });

  it("matches direct gear and talent manifest computations", () => {
    const { combatMeta, expectedTalent, expectedGear } = mutateGameplayForTest((draft) => {
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
