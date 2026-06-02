import { beforeEach, describe, expect, it } from "vitest";
import { createRunDestinationHandlers } from "@/features/alchemy/run/run-destination-handlers";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { CONSTANTS } from "@/features/alchemy/types";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";

beforeEach(() => {
  resetScreenStores();
});

describe("run destination controller actions", () => {
  it("selectRewardChoice updates reward selection through the handler", () => {
    useRunSessionStore.getState().setRewardState(createEmptyRewardState());

    const handlers = createRunDestinationHandlers({
      run: makeRunController(),
      talents: makeTalentController(),
      activeLabyrinthRewardModifiers: [],
      navigateTo: () => {},
      setScreen: () => {},
      setHasActiveBattle: () => {},
      setDiscoveredCardIds: () => {},
      setDiscoveredTrinketIds: () => {},
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
    expect(useRunSessionStore.getState().rewardState.selectedId).toBe("slash");
  });

  it("prepareDestinationScreen sets boss id for boss-only destinations", () => {
    useRunSessionStore.getState().setRewardState({
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
      setDiscoveredCardIds: () => {},
      setDiscoveredTrinketIds: () => {},
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
    expect(useRunSessionStore.getState().rewardState.selectedBossId).toBeTruthy();
  });
});
