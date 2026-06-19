import { beforeEach, describe, expect, it } from "vitest";
import { useRunDomainStore, resetRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";

beforeEach(() => {
  resetRunDomainStore();
});

describe("run domain slice dispatch", () => {
  it("exposes all expected progress actions from the composed store", () => {
    const actions = useRunDomainStore.getState();
    const expected = [
      "setRunDeck",
      "setRunGold",
      "setRunPlayerHealth",
      "setRunMaxHealth",
      "setRoomsEncountered",
      "setCurrentAct",
      "setDestinationIndexInAct",
      "setCompletedDestinations",
      "setLastOfferedDestinations",
      "setDestinationRoundsSinceOffered",
      "setDestinationOfferState",
      "setRunTrinkets",
      "setEncounteredRunEnemyIds",
      "setSelectedDifficulty",
      "setContentSystemType",
      "setCharacter",
      "resetProgress",
      "addRunGold",
      "unlockTalent",
      "resetUnlockedTalents",
      "resetRunXP",
      "clearPermanentData",
      "awardCardXP",
      "awardMysteryXP",
      "addRunMaterialsEarned",
      "clearRunMaterialsEarned",
      "finalizeRunXP",
      "initialize",
      "hydrateFromSnapshot",
    ];
    for (const name of expected) {
      expect(typeof (actions as any)[name]).toBe("function");
    }
  });

  it("exposes all expected session actions from the composed store", () => {
    const actions = useRunDomainStore.getState();
    const expected = [
      "setHasActiveRun",
      "setActiveLabyrinthModifiers",
      "setActiveLabyrinthRewardModifiers",
      "setActiveLabyrinthPendingNode",
      "setRewardState",
      "setCompanionRewardCards",
      "setRunEndMaterials",
      "setRunEndTalentXP",
      "setCorruptionResult",
      "setPendingCharacterId",
      "setPendingContentSystemType",
      "setLabyrinthMap",
      "setWildwoodDraft",
      "setShopState",
      "setAlchemistState",
      "setTrinketShopState",
      "setEquipmentShopState",
      "setMysteryEvent",
      "setMysteryCardChoices",
      "clearTransientSession",
    ];
    for (const name of expected) {
      expect(typeof (actions as any)[name]).toBe("function");
    }
  });

  it("exposes navigation actions from the composed store", () => {
    const actions = useRunDomainStore.getState();
    expect(typeof actions.setScreen).toBe("function");
    expect(typeof actions.resetNavigation).toBe("function");
  });

  it("exposes battle actions from the composed store", () => {
    const actions = useRunDomainStore.getState();
    const expected = [
      "setSyncedBattleState",
      "setDisplayOverrides",
      "clearDisplayOverrides",
      "setBattleStartState",
      "setHasActiveBattle",
      "initializeActiveBattle",
      "resetBattle",
    ];
    for (const name of expected) {
      expect(typeof (actions as any)[name]).toBe("function");
    }
  });
});
