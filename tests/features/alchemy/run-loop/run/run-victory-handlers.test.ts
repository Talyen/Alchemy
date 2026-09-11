import { act, renderHook } from "@testing-library/react";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createVictoryHandlers } from "@/features/alchemy/run-loop/run/run-flow-victory";
import { awardRunEndMaterials, clearCombatState } from "@/features/alchemy/run-loop/run/run-flow-defeat";
import { readActiveRun, readBattle, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  addRunMaterialsEarned,
  setHasActiveBattle,
  setSyncedBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeFlowHandlerDeps } from "../../../../helpers/run-flow-handler-deps";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { applyRunDefeatTeardown } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { playGoldGain } from "@/lib/audio";
import { BATTLE_END_TRANSITION_DELAY } from "@/lib/game-constants";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
vi.mock("@/features/alchemy/shared/stores/run-session-lifecycle-port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-lifecycle-port")>();
  return {
    ...actual,
    applyRunDefeatTeardown: vi.fn(),
  };
});

beforeEach(() => {
  resetAllTestStores();
  setRunSession({ hasActiveRun: true, activity: { kind: "rewards" } });
  dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, true));
});

describe("createRunFlow victory paths", () => {
  it.each([false, true])("grants one Alchemist Potion across both reward screens (skip: %s)", (skip) => {
    const card = { id: "slash", title: "Slash", art: "", descriptionLines: [], cost: 1, effects: [] };
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.LABYRINTH, runDeck: [] });
    setRunSession({
      activeLabyrinthRewardModifiers: ["alchemist", "companion"],
      rewardState: {
        choices: [card],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "labyrinth",
      },
      companionRewardCards: [{ ...card, id: "wolf-companion" }],
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));
    if (skip) handlers.skipRewards();
    else handlers.claimRewardChoice(card.id);
    const onCommit = navigateTo.mock.calls[0]![1] as () => void;
    onCommit();
    if (skip) handlers.skipRewards();
    else handlers.claimRewardChoice("wolf-companion");
    expect(readActiveRun().runDeck.filter((entry) => entry.id.endsWith("-potion"))).toHaveLength(1);
  });

  it("awardRunEndMaterials applies homestead end-of-run per-room bonuses", () => {
    setRunProgress({ roomsEncountered: 4, currentAct: 1 });
    dispatchRunSessionCommand((draft) => {
      draft.runProfile.effects.endRunHerbsPerRoom = 1;
    });
    const herbsBefore = readRunProfile().materialInventory.herbs;

    const mats = dispatchRunSessionCommand(awardRunEndMaterials);

    expect(mats.herbs).toBe(4);
    expect(readRunProfile().materialInventory.herbs).toBe(herbsBefore + 4);
    expect(readRunSession().runEndMaterials.herbs).toBe(4);
  });

  it("awardRunEndMaterials includes materials collected during the run on the summary", () => {
    setRunProgress({ roomsEncountered: 2, currentAct: 1 });
    dispatchRunSessionCommand((draft) => addRunMaterialsEarned(draft, { ...emptyInventory(), wood: 5, herbs: 2 }));

    dispatchRunSessionCommand(awardRunEndMaterials);

    expect(readRunSession().runEndMaterials.wood).toBe(5);
    expect(readRunSession().runEndMaterials.herbs).toBe(2);
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("awardRunEndMaterials adds no homestead bonus with default effects", () => {
    setRunProgress({ roomsEncountered: 6, currentAct: 2 });

    const mats = dispatchRunSessionCommand(awardRunEndMaterials);

    expect(mats).toEqual(emptyInventory());
    expect(readRunSession().runEndMaterials).toEqual(emptyInventory());
  });

  it("Wildwood Draft run end grants no materials", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.WILDWOOD, roomsEncountered: 12 });
    dispatchRunSessionCommand((draft) => {
      draft.runProfile.effects.endRunHerbsPerRoom = 2;
    });
    dispatchRunSessionCommand((draft) => addRunMaterialsEarned(draft, { ...emptyInventory(), wood: 5 }));

    const materials = dispatchRunSessionCommand(awardRunEndMaterials);

    expect(materials).toEqual(emptyInventory());
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("clearCombatState clears battle flag", () => {
    dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, true));
    dispatchRunSessionCommand(clearCombatState);
    expect(readBattle().hasActiveBattle).toBe(false);
  });

  it("handleBattleDefeat invokes applyRunDefeatTeardown for campaign", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const transition = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ transition }));
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).not.toHaveBeenCalled();
    transition.mock.calls[0][1].prepare();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState,
      }),
    );
  });

  it("handleBattleDefeat ends a labyrinth run like campaign", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const transition = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ transition }));
    handlers.handleBattleDefeat();
    expect(applyRunDefeatTeardown).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(
      ROUTE_SCREENS.GAME_OVER,
      expect.objectContaining({ delayMs: BATTLE_END_TRANSITION_DELAY }),
    );
    transition.mock.calls[0][1].prepare();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState,
      }),
    );
  });

  it.each([false, true])("defeat commits immediately while presentation can be cancelled: %s", (cancelled) => {
    vi.useFakeTimers();
    try {
      setRunSession({ hasActiveRun: true });
      const setScreen = vi.fn();
      const { result } = renderHook(() => useScreenTransitions(ROUTE_SCREENS.BATTLE, setScreen));
      const handlers = createRunFlow(makeFlowHandlerDeps({ transition: result.current.transition }));
      act(() => handlers.handleBattleDefeat());
      act(() => vi.advanceTimersByTime(BATTLE_END_TRANSITION_DELAY - 1));
      expect(setScreen).not.toHaveBeenCalled();
      expect(applyRunDefeatTeardown).toHaveBeenCalledOnce();
      if (cancelled) result.current.cancelPending();
      act(() => vi.advanceTimersByTime(1));
      expect(setScreen).toHaveBeenCalledTimes(cancelled ? 0 : 1);
      expect(applyRunDefeatTeardown).toHaveBeenCalledOnce();
      act(() => vi.advanceTimersByTime(BATTLE_END_TRANSITION_DELAY));
      expect(applyRunDefeatTeardown).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handleAbandonRun invokes applyRunDefeatTeardown for campaign", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const transition = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ transition }));
    handlers.handleAbandonRun();
    expect(applyRunDefeatTeardown).toHaveBeenCalledWith(
      expect.objectContaining({
        awardRunEndMaterials,
        finalizeRunXP: expect.any(Function),
        clearCombatState,
      }),
    );
    expect(transition).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER, expect.objectContaining({ immediate: true }));
  });

  it("handleAbandonRun abandons labyrinth run without failing the current node", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    const navigateTo = vi.fn();
    const transition = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo, transition }));
    handlers.handleAbandonRun();
    expect(navigateTo).not.toHaveBeenCalledWith(ROUTE_SCREENS.LABYRINTH_MAP);
    expect(applyRunDefeatTeardown).toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER, expect.objectContaining({ immediate: true }));
  });

  it("endLabyrinthRun uses live content system, not a stale handler port", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN });
    const transition = vi.fn();
    const handlers = createRunFlow(
      makeFlowHandlerDeps({
        transition,
      }),
    );
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.LABYRINTH });
    handlers.endLabyrinthRun();
    expect(applyRunDefeatTeardown).toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(ROUTE_SCREENS.GAME_OVER, expect.objectContaining({ immediate: true }));
  });

  it("routes Wildwood Companion rewards before completing the boss reward", () => {
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.WILDWOOD });
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
        phase: "reward",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: ["companion"],
      },
    });
    const navigateTo = vi.fn();
    const onWildwoodRewardComplete = vi.fn();

    createRunFlow(makeFlowHandlerDeps({ navigateTo, onWildwoodRewardComplete })).skipRewards();

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS, expect.any(Function));
    expect(onWildwoodRewardComplete).not.toHaveBeenCalled();
  });

  it("commits Wildwood reward handoff in the victory command draft", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.WILDWOOD,
      runDeck: [],
      runPlayerHealth: 20,
      runMaxHealth: 20,
    });
    setRunSession({
      wildwoodDraft: {
        phase: "battle",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: "forge-golem",
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    });
    const handlers = createVictoryHandlers(makeFlowHandlerDeps());
    handlers.commitVictoryResult();
    expect(readRunSession().wildwoodDraft?.phase).toBe("reward");
  });

  it("plays gold gain SFX when Wildwood victory persists in-combat gold", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.WILDWOOD,
      gold: 10,
      runDeck: [],
      runPlayerHealth: 20,
      runMaxHealth: 20,
    });
    dispatchRunSessionCommand((draft) =>
      setSyncedBattleState(draft, {
        ...readBattle().battleState,
        gold: 15,
      }),
    );
    setRunSession({
      wildwoodDraft: {
        phase: "battle",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: "forge-golem",
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    });

    createVictoryHandlers(makeFlowHandlerDeps()).commitVictoryResult();

    expect(playGoldGain).toHaveBeenCalledOnce();
  });

  it("skips a resumed card reward without claiming its saved selection", () => {
    const card = { id: "slash", title: "Slash", art: "", descriptionLines: [], cost: 1, effects: [] };
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, runDeck: [] });
    setRunSession({
      rewardState: {
        choices: [card],
        gold: 0,
        materials: emptyInventory(),
        selectedId: card.id,
        destinations: [],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: null,
    });
    const navigateTo = vi.fn();
    createRunFlow(makeFlowHandlerDeps({ navigateTo })).skipRewards();
    expect(readActiveRun().runDeck).toEqual([]);
    expect(navigateTo).toHaveBeenCalledTimes(1);
  });

  it("claims the clicked card instead of a different saved selection", () => {
    const first = { id: "slash", title: "Slash", art: "", descriptionLines: [], cost: 1, effects: [] };
    const second = { ...first, id: "bash", title: "Bash" };
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.CAMPAIGN, runDeck: [] });
    setRunSession({
      rewardState: {
        choices: [first, second],
        gold: 0,
        materials: emptyInventory(),
        selectedId: first.id,
        destinations: [],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: null,
    });
    createRunFlow(makeFlowHandlerDeps()).claimRewardChoice(second.id);
    expect(readActiveRun().runDeck.map((card) => card.id)).toEqual([second.id]);
  });

  it("claimRewardChoice ignores a second call while claim is in flight", () => {
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
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      runDeck: [],
    });
    setRunSession({
      rewardState: {
        choices: [card],
        gold: 0,
        materials: emptyInventory(),
        selectedId: card.id,
        destinations: [DESTINATIONS.NORMAL_COMBAT],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: null,
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));

    handlers.claimRewardChoice("reward-card");
    createRunFlow(makeFlowHandlerDeps({ navigateTo })).claimRewardChoice("reward-card");

    expect(readActiveRun().runDeck).toHaveLength(1);
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(true);

    expect(readRunSession().rewardFlow.state.destinations).toEqual([DESTINATIONS.NORMAL_COMBAT]);
    expect(readRunSession().rewardFlow.state.choices).toEqual([]);

    const onCommit = navigateTo.mock.calls[0][1] as () => void;
    onCommit();
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(false);
    expect(readRunSession().rewardFlow.state.choices).toEqual([]);
  });

  it("claimRewardChoice commits the companion handoff before navigation", () => {
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
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      runDeck: [],
    });
    setRunSession({
      rewardState: {
        choices: [primary],
        gold: 5,
        materials: emptyInventory(),
        selectedId: primary.id,
        destinations: [DESTINATIONS.NORMAL_COMBAT],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: "normal",
        lastVictoryContentSystem: "campaign",
      },
      companionRewardCards: [companion],
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));

    handlers.claimRewardChoice("reward-card");

    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.REWARDS, expect.any(Function));
    expect(readActiveRun().runDeck.map((card) => card.id)).toEqual([primary.id]);
    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(true);

    expect(readRunSession().rewardFlow.state.choices).toEqual([companion]);
    expect(readRunSession().rewardFlow.companionCards).toBeNull();

    const onCommit = navigateTo.mock.calls[0]![1] as () => void;
    onCommit();

    expect(readRunSession().rewardFlow.claim.kind === "reward").toBe(false);
    expect(readRunSession().rewardFlow.companionCards).toBeNull();
    const companionChoices = readRunSession().rewardFlow.state.choices;
    expect(companionChoices.every((card) => "id" in card)).toBe(true);
    expect(companionChoices.map((card) => ("id" in card ? card.id : card.instanceId))).toEqual([companion.id]);
    expect(readRunSession().rewardFlow.state.selectedId).toBeNull();
    expect(readRunSession().rewardFlow.state.gold).toBe(0);
  });

  it("handleDestinationChoice ignores a second call after destinations are cleared", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      completedDestinations: [],
      destinationIndexInAct: 0,
    });
    setRunSession({
      rewardState: {
        choices: [],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    const navigateTo = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));

    handlers.handleDestinationChoice(DESTINATIONS.CAMPFIRE);
    const remountedHandlers = createRunFlow(makeFlowHandlerDeps({ navigateTo }));
    remountedHandlers.handleDestinationChoice(DESTINATIONS.CAMPFIRE);
    remountedHandlers.handleDestinationChoice(DESTINATIONS.CARD_SHOP);

    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CAMPFIRE, expect.any(Function));

    expect(readActiveRun().completedDestinations).toEqual([]);
    expect(readActiveRun().destinationIndexInAct).toBe(0);
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "destination", destination: DESTINATIONS.CAMPFIRE });
    expect(readRunSession().rewardFlow.state.destinations).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.CARD_SHOP]);

    const onCommit = navigateTo.mock.calls[0][1] as () => void;
    onCommit();

    expect(readActiveRun().completedDestinations).toEqual([DESTINATIONS.CAMPFIRE]);
    expect(readActiveRun().destinationIndexInAct).toBe(1);
    expect(readRunSession().rewardFlow.state.destinations).toEqual([]);
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "idle" });
  });

  it("handleDestinationChoice defers mystery destination commit until screen commit", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.CAMPAIGN,
      completedDestinations: [],
      destinationIndexInAct: 0,
    });
    setRunSession({
      rewardState: {
        choices: [],
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: [DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
        rewardType: "card",
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
    const beginMysteryEvent = vi.fn();
    const handlers = createRunFlow(makeFlowHandlerDeps({ beginMysteryEvent }));

    handlers.handleDestinationChoice(DESTINATIONS.MYSTERY);

    expect(beginMysteryEvent).toHaveBeenCalledTimes(1);
    expect(beginMysteryEvent).toHaveBeenCalledWith(expect.any(Function));
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "destination", destination: DESTINATIONS.MYSTERY });
    expect(readRunSession().rewardFlow.state.destinations).toEqual([DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE]);
    expect(readActiveRun().completedDestinations).toEqual([]);

    const onCommit = beginMysteryEvent.mock.calls[0]![0] as () => void;
    onCommit();

    expect(readActiveRun().completedDestinations).toEqual([DESTINATIONS.MYSTERY]);
    expect(readRunSession().rewardFlow.state.destinations).toEqual([]);
    expect(readRunSession().rewardFlow.claim).toEqual({ kind: "idle" });
  });
});
