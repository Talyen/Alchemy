import { describe, expect, it, beforeEach, vi } from "vitest";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { addRunMaterialsEarned } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useRunProfileStore } from "../../../../helpers/gameplay-store-test";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunSession,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { isGameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";

vi.mock("@/lib/audio", () => ({
  playVictory: vi.fn(),
  stopAllSfx: vi.fn(),
  playUISound: vi.fn(),
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
  resetRunProgressSlice();
  resetTransientRunUi();
});

function makeHandlers() {
  return createRunFlowHandlers(makeFlowHandlerDeps());
}

describe("createRunFlowHandlers victory paths", () => {
  it("awardRunEndMaterials applies homestead end-of-run per-room bonuses", () => {
    setRunProgress({ roomsEncountered: 4, currentAct: 1 });
    useRunProfileStore.setState((profile) => {
      profile.effects.endRunHerbsPerRoom = 1;
    });
    const herbsBefore = useRunProfileStore.getState().materialInventory.herbs;

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats.herbs).toBe(4);
    expect(useRunProfileStore.getState().materialInventory.herbs).toBe(herbsBefore + 4);
    expect(getRunSessionStoreView().runEndMaterials.herbs).toBe(4);
  });

  it("awardRunEndMaterials includes materials collected during the run on the summary", () => {
    setRunProgress({ roomsEncountered: 2, currentAct: 1 });
    addRunMaterialsEarned({ ...emptyInventory(), wood: 5, herbs: 2 });

    makeHandlers().awardRunEndMaterials();

    expect(getRunSessionStoreView().runEndMaterials.wood).toBe(5);
    expect(getRunSessionStoreView().runEndMaterials.herbs).toBe(2);
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("awardRunEndMaterials adds no homestead bonus with default effects", () => {
    setRunProgress({ roomsEncountered: 6, currentAct: 2 });

    const mats = makeHandlers().awardRunEndMaterials();

    expect(mats).toEqual(emptyInventory());
    expect(getRunSessionStoreView().runEndMaterials).toEqual(emptyInventory());
  });

  it("Wildwood Draft run end grants no materials", () => {
    setRunProgress({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, roomsEncountered: 12 });
    useRunProfileStore.setState((profile) => {
      profile.effects.endRunHerbsPerRoom = 2;
    });
    addRunMaterialsEarned({ ...emptyInventory(), wood: 5 });

    const materials = makeHandlers().awardRunEndMaterials();

    expect(materials).toEqual(emptyInventory());
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
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
        version: 3 as const,
        phase: "reward",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: ["companion"],
        rewardType: "card",
        rewardChoiceIds: [],
        rewardGearChoices: [],
        selectedRewardId: null,
      },
    });
    const navigateTo = vi.fn();
    const onWildwoodRewardComplete = vi.fn();

    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo, onWildwoodRewardComplete })).finishRewards();

    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS, expect.any(Function));
    expect(onWildwoodRewardComplete).not.toHaveBeenCalled();
  });

  it("commits Wildwood reward handoff in the victory command draft", () => {
    setRunProgress({
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD,
      runDeck: [],
      runPlayerHealth: 20,
      runMaxHealth: 20,
    });
    setRunSession({
      wildwoodDraft: {
        version: 3 as const,
        phase: "battle",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: "forge-golem",
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
        rewardType: null,
        rewardChoiceIds: [],
        rewardGearChoices: [],
        selectedRewardId: null,
      },
    });
    let receivedDraft = false;
    const commitWildwoodVictory = vi.fn((draftOrResult: unknown) => {
      receivedDraft = isGameplayDraft(draftOrResult);
    });
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ commitWildwoodVictory }));

    handlers.commitVictoryResult();

    expect(commitWildwoodVictory).toHaveBeenCalledTimes(1);
    expect(receivedDraft).toBe(true);
  });

  it("finishRewards ignores a second call while claim is in flight", () => {
    const card = {
      id: "reward-card",
      uid: 1,
      title: "Reward Card",
      descriptionLines: [],
      art: "",
      cost: 1,
      effects: [],
    };
    setRunProgress({
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
      runDeck: [],
    });
    setRunSession({
      rewardState: {
        choices: [card],
        gold: 0,
        materials: emptyInventory(),
        selectedId: card.id,
        destinations: [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: null,
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));

    handlers.finishRewards();
    createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo })).finishRewards();

    expect(getRunProgressStoreView().runDeck).toHaveLength(1);
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(getRunSessionStoreView().rewardClaimInFlight).toBe(true);
    // Offer UI stays populated until navigation commits (no hollow Victory exit).
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([CONSTANTS.DESTINATIONS.NORMAL_COMBAT]);
    expect(getRunSessionStoreView().rewardState.choices).toEqual([card]);

    const onCommit = navigateTo.mock.calls[0][1] as () => void;
    onCommit();
    expect(getRunSessionStoreView().rewardClaimInFlight).toBe(false);
    expect(getRunSessionStoreView().rewardState.choices).toEqual([]);
  });

  it("finishRewards defers companion handoff until navigation commit", () => {
    const primary = {
      id: "reward-card",
      uid: 1,
      title: "Reward Card",
      descriptionLines: [],
      art: "",
      cost: 1,
      effects: [],
    };
    const companion = {
      id: "wolf-companion",
      uid: 2,
      title: "Wolf Companion",
      descriptionLines: [],
      art: "",
      cost: 0,
      effects: [],
    };
    setRunProgress({
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
      runDeck: [],
    });
    setRunSession({
      rewardState: {
        choices: [primary],
        gold: 5,
        materials: emptyInventory(),
        selectedId: primary.id,
        destinations: [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: [companion],
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));

    handlers.finishRewards();

    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS, expect.any(Function));
    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toEqual([primary.id]);
    expect(getRunSessionStoreView().rewardClaimInFlight).toBe(true);
    // Primary offer stays visible until commit (no hollow / early companion swap).
    expect(getRunSessionStoreView().rewardState.choices).toEqual([primary]);
    expect(getRunSessionStoreView().companionRewardCards).toEqual([companion]);

    const onCommit = navigateTo.mock.calls[0]![1] as () => void;
    onCommit();

    expect(getRunSessionStoreView().rewardClaimInFlight).toBe(false);
    expect(getRunSessionStoreView().companionRewardCards).toBeNull();
    const companionChoices = getRunSessionStoreView().rewardState.choices;
    expect(companionChoices.every((card) => "id" in card)).toBe(true);
    expect(companionChoices.map((card) => ("id" in card ? card.id : card.instanceId))).toEqual([companion.id]);
    expect(getRunSessionStoreView().rewardState.selectedId).toBeNull();
    expect(getRunSessionStoreView().rewardState.gold).toBe(0);
  });

  it("handleDestinationChoice ignores a second call after destinations are cleared", () => {
    setRunProgress({
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
      completedDestinations: [],
      destinationIndexInAct: 0,
    });
    setRunSession({
      rewardState: {
        choices: [],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [CONSTANTS.DESTINATIONS.CAMPFIRE, CONSTANTS.DESTINATIONS.MERCHANT_SHOP],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));

    handlers.handleDestinationChoice(CONSTANTS.DESTINATIONS.CAMPFIRE);
    const remountedHandlers = createRunFlowHandlers(makeFlowHandlerDeps({ navigateTo }));
    remountedHandlers.handleDestinationChoice(CONSTANTS.DESTINATIONS.CAMPFIRE);
    remountedHandlers.handleDestinationChoice(CONSTANTS.DESTINATIONS.MERCHANT_SHOP);

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.CAMPFIRE, expect.any(Function));
    // Progress commits only after the navigation callback runs.
    expect(getRunProgressStoreView().completedDestinations).toEqual([]);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(0);
    expect(getRunSessionStoreView().pendingDestinationClaim).toBe(CONSTANTS.DESTINATIONS.CAMPFIRE);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([
      CONSTANTS.DESTINATIONS.CAMPFIRE,
      CONSTANTS.DESTINATIONS.MERCHANT_SHOP,
    ]);

    const onCommit = navigateTo.mock.calls[0][1] as () => void;
    onCommit();

    expect(getRunProgressStoreView().completedDestinations).toEqual([CONSTANTS.DESTINATIONS.CAMPFIRE]);
    expect(getRunProgressStoreView().destinationIndexInAct).toBe(1);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([]);
    expect(getRunSessionStoreView().pendingDestinationClaim).toBeNull();
  });

  it("handleDestinationChoice defers mystery destination commit until screen commit", () => {
    setRunProgress({
      contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
      completedDestinations: [],
      destinationIndexInAct: 0,
    });
    setRunSession({
      rewardState: {
        choices: [],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [CONSTANTS.DESTINATIONS.MYSTERY, CONSTANTS.DESTINATIONS.CAMPFIRE],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    const beginMysteryEvent = vi.fn();
    const handlers = createRunFlowHandlers(makeFlowHandlerDeps({ beginMysteryEvent }));

    handlers.handleDestinationChoice(CONSTANTS.DESTINATIONS.MYSTERY);

    expect(beginMysteryEvent).toHaveBeenCalledTimes(1);
    expect(beginMysteryEvent).toHaveBeenCalledWith(expect.any(Function));
    expect(getRunSessionStoreView().pendingDestinationClaim).toBe(CONSTANTS.DESTINATIONS.MYSTERY);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([
      CONSTANTS.DESTINATIONS.MYSTERY,
      CONSTANTS.DESTINATIONS.CAMPFIRE,
    ]);
    expect(getRunProgressStoreView().completedDestinations).toEqual([]);

    const onCommit = beginMysteryEvent.mock.calls[0]![0] as () => void;
    onCommit();

    expect(getRunProgressStoreView().completedDestinations).toEqual([CONSTANTS.DESTINATIONS.MYSTERY]);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual([]);
    expect(getRunSessionStoreView().pendingDestinationClaim).toBeNull();
  });
});
