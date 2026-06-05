import { beforeEach, describe, expect, it } from "vitest";
import { createRunDestinationHandlers } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";
import { getRunSessionStoreView } from "../../helpers/run-domain-store-test";

beforeEach(() => {
  resetTransientRunUi();
});

describe("run destination controller actions", () => {
  it("selectRewardChoice updates reward selection through the handler", () => {
    getRunSessionStoreView().setRewardState(createEmptyRewardState());

    const handlers = createRunDestinationHandlers({
      run: makeRunController(),
      talents: makeTalentController(),
      activeLabyrinthRewardModifiers: [],
      navigateTo: () => {},
      setScreen: () => {},
      setHasActiveBattle: () => {},
      onInitShop: () => {},
      onInitAlchemist: () => {},
      onStartBattle: () => {},
      onStartBossBattle: () => {},
      onStartBossById: () => true,
      onLabyrinthClearNode: () => {},
      onMarkDifficultyCompleted: () => {},
      contentNav: {
        createInitialDestinations: () => createEmptyRewardState(),
      } as never,
      awardRunEndMaterials: () => {},
      clearCombatState: () => {},
      beginMysteryEvent: () => {},
      clearMysteryCardChoices: () => {},
    });

    handlers.selectRewardChoice("slash");
    expect(getRunSessionStoreView().rewardState.selectedId).toBe("slash");
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    getRunSessionStoreView().setRewardState({
      ...createEmptyRewardState(),
      destinations: [CONSTANTS.DESTINATIONS.BOSS_COMBAT],
    });

    const handlers = createRunDestinationHandlers({
      run: makeRunController(),
      talents: makeTalentController(),
      activeLabyrinthRewardModifiers: [],
      navigateTo: () => {},
      setScreen: () => {},
      setHasActiveBattle: () => {},
      onInitShop: () => {},
      onInitAlchemist: () => {},
      onStartBattle: () => {},
      onStartBossBattle: () => {},
      onStartBossById: () => true,
      onLabyrinthClearNode: () => {},
      onMarkDifficultyCompleted: () => {},
      contentNav: {
        createInitialDestinations: () => createEmptyRewardState(),
      } as never,
      awardRunEndMaterials: () => {},
      clearCombatState: () => {},
      beginMysteryEvent: () => {},
      clearMysteryCardChoices: () => {},
    });

    handlers.prepareDestinationScreen();
    expect(getRunSessionStoreView().rewardState.selectedBossId).toBeTruthy();
  });
});
