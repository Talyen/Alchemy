import { beforeEach, describe, expect, it } from "vitest";
import {
  resetRunDomainStore,
  useRunBattleDomainStore,
  useRunDomainStore,
  useRunProfileStore,
  useRunTransientStore,
} from "../../../../helpers/gameplay-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

function expectActions(actions: object, names: string[]) {
  for (const name of names) {
    expect(typeof (actions as any)[name]).toBe("function");
  }
}

describe("run domain slice dispatch", () => {
  it("exposes all expected active-run progress actions from the domain store", () => {
    expectActions(useRunDomainStore.getState(), [
      "setRunDeck",
      "setRunGold",
      "setRunPlayerHealth",
      "setRunMaxHealth",
      "setRoomsEncountered",
      "setCurrentAct",
      "setDestinationIndexInAct",
      "setCompletedDestinations",
      "setDestinationOfferState",
      "setRunTrinkets",
      "setEncounteredRunEnemyIds",
      "setSelectedDifficulty",
      "setContentSystemType",
      "setCharacter",
      "resetProgress",
      "addRunGold",
      "resetRunXP",
      "awardCardXP",
      "awardMysteryXP",
      "addRunMaterialsEarned",
      "clearRunMaterialsEarned",
      "initialize",
      "hydrateFromSnapshot",
    ]);
  });

  it("exposes permanent progression actions from the profile store", () => {
    expectActions(useRunProfileStore.getState(), [
      "unlockTalent",
      "unlockAllTalents",
      "resetUnlockedTalents",
      "clearPermanentData",
      "applyTalentState",
      "mergeRunTalentXPIntoProfile",
      "addMaterials",
      "setMaterials",
      "constructBuilding",
      "plantFarm",
      "completeResearch",
      "bondCompanion",
    ]);
  });

  it("exposes all expected session actions from the transient store", () => {
    expectActions(useRunTransientStore.getState(), [
      "setHasActiveRun",
      "beginRewardClaim",
      "releaseRewardClaim",
      "beginDestinationClaim",
      "cancelDestinationClaim",
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
      "setStarterDraftChoices",
      "setShopState",
      "setAlchemistState",
      "setTrinketShopState",
      "setEquipmentShopState",
      "setMysteryEvent",
      "setMysteryCardChoices",
      "setMysteryGrantedTrinketIds",
      "clearTransientSession",
      "applyDestinationChoices",
    ]);
  });

  it("exposes navigation actions from the domain store", () => {
    const actions = useRunDomainStore.getState();
    expect(typeof actions.setScreen).toBe("function");
    expect(typeof actions.resetNavigation).toBe("function");
  });

  it("exposes battle actions from the battle domain store", () => {
    expectActions(useRunBattleDomainStore.getState(), [
      "setSyncedBattleState",
      "setPendingBattleTransition",
      "clearPendingTransitionResumeRequired",
      "setDisplayOverrides",
      "clearDisplayOverrides",
      "setBattleStartState",
      "setHasActiveBattle",
      "initializeActiveBattle",
    ]);
  });

  it("keeps permanent, session, and battle state off the domain store", () => {
    const state = useRunDomainStore.getState() as unknown as Record<string, unknown>;
    expect(state.profile).toBeUndefined();
    expect(state.session).toBeUndefined();
    expect(state.battle).toBeUndefined();
  });
});
