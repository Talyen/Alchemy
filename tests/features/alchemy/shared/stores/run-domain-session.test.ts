import { battleSnapshot } from "@/lib/battle";
import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState, readActivityData } from "@/lib/active-run-session";
import {
  abandonRun,
  applyRunDefeatTeardown,
  finalizeRunEndSession,
  syncBattleToRun as mutateBattleToRun,
  syncRunToBattleStart as mutateRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-materials";
import { finalizeRunXP as mutateFinalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { subscribeGameplayCommits } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  setHasActiveBattle as mutateHasActiveBattle,
  setHasActiveRun as mutateHasActiveRun,
  initializeActiveBattle as mutateInitializeActiveBattle,
  setRewardState as mutateRewardState,
  setSyncedBattleState as mutateSyncedBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-reads";
import { saveAlchemySaveData } from "@/features/alchemy/shared/storage";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import {
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunSessionSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
const syncBattleToRun = createRunSessionCommand(mutateBattleToRun);
const syncRunToBattleStart = createRunSessionCommand(mutateRunToBattleStart);
const initializeActiveBattle = createRunSessionCommand(mutateInitializeActiveBattle);
const setSyncedBattleState = createRunSessionCommand(mutateSyncedBattleState);
const setHasActiveBattle = createRunSessionCommand(mutateHasActiveBattle);
const setHasActiveRun = createRunSessionCommand(mutateHasActiveRun);
const setRewardState = createRunSessionCommand(mutateRewardState);

beforeEach(() => {
  resetRunDomainStore();
});

describe("session slice", () => {
  beforeEach(() => {
    resetRunSessionSlice();
  });

  it("has empty shop and alchemist state", () => {
    expect(readActivityData(readRunSession().activity, "shop").cards).toEqual([]);
    expect(readActivityData(readRunSession().activity, "alchemist").potions).toEqual([]);
  });

  it("starts with empty reward state and no active run", () => {
    expect(readRunSession().rewardFlow.state).toEqual(createEmptyRewardState());
    expect(readRunSession().hasActiveRun).toBe(false);
  });

  it("setRewardState accepts direct values and updaters", () => {
    setRewardState({ ...createEmptyRewardState(), gold: 50 });
    expect(readRunSession().rewardFlow.state.gold).toBe(50);
    setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(readRunSession().rewardFlow.state.gold).toBe(75);
  });
});

describe("battle slice", () => {
  beforeEach(() => {
    resetRunBattleSlice();
  });

  it("initializes battleState and hasActiveBattle defaults", () => {
    expect(readBattle().battleState).not.toBeNull();
    expect(readBattle().hasActiveBattle).toBe(false);
  });

  it("hydrates and resets active battle", () => {
    initializeActiveBattle({ ...defaultBattleState(), turn: 4, playerHealth: 9 });
    expect(readBattle().hasActiveBattle).toBe(true);
    expect(readBattle().pendingTransitionResumeRequired).toBe(false);
    initializeActiveBattle(null);
    expect(readBattle().hasActiveBattle).toBe(false);
  });

  it("requires resume only when hydrating with a pending transition", () => {
    const resultState = { ...defaultBattleState(), turn: 2 };
    initializeActiveBattle(
      { ...defaultBattleState(), turnPhase: "enemy", hand: [] },
      { kind: "enemy-turn", resultState, playerTurnSkipped: false },
    );
    expect(readBattle().pendingTransitionResumeRequired).toBe(true);
    expect(readBattle().pendingBattleTransition).toEqual({
      kind: "enemy-turn",
      resultState: battleSnapshot(resultState),
      playerTurnSkipped: false,
    });
  });
});

describe("run transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(readActiveRun().runPlayerHealth).toBe(health);
  });

  it("does not restore Health from Grove's Favor at battle start", () => {
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, runBoons: ["groves-favor"] });

    expect(syncRunToBattleStart()).toBe(18);
    expect(readActiveRun().runPlayerHealth).toBe(18);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(readActiveRun().runPlayerHealth).toBe(14);
  });

  it("teardownRun clears session flags and returns to menu", () => {
    teardownRun();
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(readActiveRunScreen()).toBe(ROUTE_SCREENS.MENU);
  });

  it("finalizeRunEndSession clears hasActiveRun", async () => {
    setHasActiveRun(true);
    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });
    expect(readRunSession().hasActiveRun).toBe(false);
    await vi.waitFor(() => {
      expect(saveAlchemySaveData).toHaveBeenCalledWith(expect.objectContaining({ activeRun: null }));
    });
  });

  it("finalizeRunEndSession ignores a second call after hasActiveRun is cleared", () => {
    setHasActiveRun(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
  });

  it("abandonRun preserves the run-end snapshot for the End Run screen", () => {
    setHasActiveRun(true);
    setHasActiveBattle(true);
    setRunProgress({
      runTalentXP: { physical: 10 },
      runMaterialsEarned: { ...emptyInventory(), wood: 5 },
    });

    const ended = abandonRun({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP });

    expect(ended).toBe(true);
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(readRunSession().runEndTalentXP.physical).toBeGreaterThan(0);
    expect(readRunSession().runEndMaterials.wood).toBe(5);
    expect(readBattle().pendingBattleTransition).toBeNull();

    expect(abandonRun({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP })).toBe(false);
  });

  it("applyRunDefeatTeardown commits run and combat teardown together", async () => {
    setHasActiveRun(true);
    setHasActiveBattle(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    const finalizeRunXP = vi.fn();
    const clearCombatState = (draft: GameplayDraft) => mutateHasActiveBattle(draft, false);
    const clearCombatPresentation = vi.fn();
    const commits: Array<{ hasActiveRun: boolean; hasActiveBattle: boolean }> = [];
    const unsubscribe = subscribeRunSessionCommits(() => {
      commits.push({
        hasActiveRun: readRunSession().hasActiveRun,
        hasActiveBattle: readBattle().hasActiveBattle,
      });
    });

    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
    unsubscribe();

    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
    expect(finalizeRunXP).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(saveAlchemySaveData).toHaveBeenCalledWith(expect.objectContaining({ activeRun: null }));
    });
    expect(commits).toEqual([{ hasActiveRun: false, hasActiveBattle: false }]);
    expect(clearCombatPresentation).toHaveBeenCalledOnce();
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});

describe("session narrow hooks", () => {
  it("useRunSessionBattleContext reports battle phase when combat is active", () => {
    setHasActiveBattle(true);
    const { result } = renderHook(() => useRunSessionBattleContext(ROUTE_SCREENS.BATTLE));
    expect(result.current.phase).toBe("battle");
    expect(result.current.battle.hasActiveBattle).toBe(true);
  });

  it("useRunSessionNavigationSlice reports meta on menu", () => {
    const { result } = renderHook(() => useRunSessionNavigationSlice(ROUTE_SCREENS.MENU));
    expect(result.current.phase).toBe("meta");
    expect(result.current.hasActiveBattle).toBe(false);
  });

  it("notifies the session and gameplay commit subscriptions once per command", () => {
    const calls: string[] = [];
    const unsubscribeSession = subscribeRunSessionCommits(() => calls.push("session"));
    const unsubscribeGameplay = subscribeGameplayCommits(() => calls.push("gameplay"));
    setHasActiveBattle(true);
    unsubscribeSession();
    unsubscribeGameplay();
    expect(calls).toEqual(["session", "gameplay"]);
  });
});
