import { describe, expect, it, beforeEach, vi } from "vitest";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { readActiveRunStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import {
  getBattleStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunSession,
  setRunProgress,
} from "../../helpers/run-domain-store-test";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeFlowHandlerDeps } from "../../helpers/run-flow-handler-deps";

vi.mock("@/lib/audio", () => ({
  playVictory: vi.fn(),
  stopAllSfx: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-transitions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-transitions")>();
  return {
    ...actual,
    applyRunDefeatTeardown: vi.fn(),
  };
});

import { applyRunDefeatTeardown } from "@/features/alchemy/shared/stores/run-transitions";

beforeEach(() => {
  vi.clearAllMocks();
  resetRunBattleSlice();
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
  resetRunProgressSlice();
  resetTransientRunUi();
});

function makeHandlers() {
  return createRunFlowHandlers(makeFlowHandlerDeps());
}

describe("createRunFlowHandlers victory paths", () => {
  it("awardRunEndMaterials applies homestead end-of-run per-room bonuses", () => {
    setRunProgress({ roomsEncountered: 4, currentAct: 1 });
    useHomesteadStore.setState((s) => ({
      effects: { ...s.effects, endRunHerbsPerRoom: 1 },
    }));
    const herbsBefore = useHomesteadStore.getState().materialInventory.herbs;

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats.herbs).toBe(4);
    expect(useHomesteadStore.getState().materialInventory.herbs).toBe(herbsBefore + 4);
    expect(getRunSessionStoreView().runEndMaterials.herbs).toBe(4);
  });

  it("awardRunEndMaterials includes materials collected during the run on the summary", () => {
    setRunProgress({ roomsEncountered: 2, currentAct: 1 });
    readActiveRunStore().addRunMaterialsEarned({ ...emptyInventory(), wood: 5, herbs: 2 });

    makeHandlers().awardRunEndMaterials();

    expect(getRunSessionStoreView().runEndMaterials.wood).toBe(5);
    expect(getRunSessionStoreView().runEndMaterials.herbs).toBe(2);
    expect(readActiveRunStore().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("awardRunEndMaterials adds no homestead bonus with default effects", () => {
    setRunProgress({ roomsEncountered: 6, currentAct: 2 });

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats).toEqual(emptyInventory());
    expect(getRunSessionStoreView().runEndMaterials).toEqual(emptyInventory());
  });

  it("Wildwood Draft run end grants no materials", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, roomsEncountered: 12 });
    useHomesteadStore.setState((state) => ({
      effects: { ...state.effects, endRunHerbsPerRoom: 2 },
    }));
    readActiveRunStore().addRunMaterialsEarned({ ...emptyInventory(), wood: 5 });

    const materials = makeHandlers().awardRunEndMaterials();

    expect(materials).toEqual(emptyInventory());
    expect(readActiveRunStore().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("clearCombatState clears battle flag", () => {
    getBattleStoreView().setHasActiveBattle(true);
    makeHandlers().clearCombatState();
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("handleBattleDefeat invokes applyRunDefeatTeardown for campaign", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const handlers = makeHandlers();
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials: handlers.awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState: handlers.clearCombatState,
      }),
    );
  });

  it("handleBattleDefeat routes labyrinth to map without teardown", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
  });

  it("handleAbandonRun invokes applyRunDefeatTeardown for campaign", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const transition = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ transition }));
    handlers.handleAbandonRun();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials: handlers.awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState: handlers.clearCombatState,
      }),
    );
    expect(transition).toHaveBeenCalledWith(CONSTANTS.SCREENS.GAME_OVER, expect.objectContaining({ immediate: true }));
  });

  it("handleAbandonRun abandons labyrinth run without failing the current node", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const navigateTo = vi.fn();
    const onLabyrinthFailNode = vi.fn();
    const transition = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo, onLabyrinthFailNode, transition }));
    handlers.handleAbandonRun();
    expect(onLabyrinthFailNode).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
    expect(applyRunDefeatTeardown).toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(CONSTANTS.SCREENS.GAME_OVER, expect.objectContaining({ immediate: true }));
  });

  it("routes Wildwood Companion rewards before completing the boss reward", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const companion = {
      id: "wolf-companion",
      uid: 1,
      title: "Wolf Companion",
      descriptionLines: [],
      art: "",
      cost: 0,
      effects: [],
    };
    setRunSession({
      rewardState: {
        choices: [],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "boss",
        lastVictoryContentSystem: "wildwood",
      },
      companionRewardCards: [companion],
      wildwoodDraft: {
        version: 2,
        phase: "reward",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: ["companion"],
        rewardType: "card",
        rewardChoiceIds: [],
        selectedRewardId: null,
      },
    });
    const navigateTo = vi.fn();
    const onWildwoodRewardComplete = vi.fn();

    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo, onWildwoodRewardComplete })).finishRewards();

    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS, expect.any(Function));
    expect(onWildwoodRewardComplete).not.toHaveBeenCalled();
  });
});
