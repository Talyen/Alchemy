import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState } from "@/lib/active-run-session";
import {
  applyRunDefeatTeardown,
  finalizeRunEndSession,
  flushSaveAfterRunEnd,
  restoreRun,
  syncBattleToRun as mutateBattleToRun,
  syncRunMaxHealthFromGearMutation as mutateRunMaxHealthFromGearMutation,
  syncRunToBattleStart as mutateRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-transitions";
import { getCombinedRunGold, getCurrentRunPhase } from "../../../../helpers/run-session-assertions";
import {
  applyRunStartSnapshot as mutateRunStartSnapshot,
  finalizeRunXP as mutateFinalizeRunXP,
  unlockAllTalents as mutateUnlockAllTalents,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useRunProfileStore } from "../../../../helpers/gameplay-store-test";
import {
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { createGameplayDraftActions } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { cardLibrary, computeTalentPoints, getStartingDeck, type BattleCard } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import { createRunRngState } from "@/lib/run-rng";
import { ANCIENT_ALTAR_MYSTERY_VISIT, createCompleteActiveRunData } from "./active-run-data-fixture";

const syncBattleToRun = createRunSessionCommand(mutateBattleToRun);
const syncRunMaxHealthFromGearMutation = createRunSessionCommand(mutateRunMaxHealthFromGearMutation);
const syncRunToBattleStart = createRunSessionCommand(mutateRunToBattleStart);
const applyRunStartSnapshot = createRunSessionCommand(mutateRunStartSnapshot);
const finalizeRunXP = createRunSessionCommand(mutateFinalizeRunXP);
const unlockAllTalents = createRunSessionCommand(mutateUnlockAllTalents);

vi.mock("@/features/alchemy/shared/storage/flush-save", () => ({
  flushAlchemySaveNow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audio", () => ({
  playDefeat: vi.fn(),
  stopAllSfx: vi.fn(),
}));

import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunSessionSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("session slice", () => {
  beforeEach(() => {
    resetRunSessionSlice();
  });

  it("has empty shop and alchemist state", () => {
    expect(getRunSessionStoreView().shopState.cards).toEqual([]);
    expect(getRunSessionStoreView().alchemistState.potions).toEqual([]);
  });

  it("starts with empty reward state and no active run", () => {
    expect(getRunSessionStoreView().rewardState).toEqual(createEmptyRewardState());
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
  });

  it("setRewardState accepts direct values and updaters", () => {
    getRunSessionStoreView().setRewardState({ ...createEmptyRewardState(), gold: 50 });
    expect(getRunSessionStoreView().rewardState.gold).toBe(50);
    getRunSessionStoreView().setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(getRunSessionStoreView().rewardState.gold).toBe(75);
  });
});

describe("battle slice", () => {
  beforeEach(() => {
    resetRunBattleSlice();
  });

  it("initializes battleState and hasActiveBattle defaults", () => {
    expect(getBattleStoreView().battleState).not.toBeNull();
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("hydrates and resets active battle", () => {
    getBattleStoreView().initializeActiveBattle({ ...defaultBattleState(), turn: 4, playerHealth: 9 });
    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    expect(getBattleStoreView().pendingTransitionResumeRequired).toBe(false);
    getBattleStoreView().initializeActiveBattle(null);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("requires resume only when hydrating with a pending transition", () => {
    const resultState = { ...defaultBattleState(), turn: 2 };
    getBattleStoreView().initializeActiveBattle(
      { ...defaultBattleState(), turnPhase: "enemy", hand: [] },
      { kind: "enemy-turn", resultState, playerTurnSkipped: false },
    );
    expect(getBattleStoreView().pendingTransitionResumeRequired).toBe(true);
    expect(getBattleStoreView().pendingBattleTransition).toEqual({
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    });
  });
});

describe("run transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, runGold: 40, initialized: true });
    getBattleStoreView().setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    getRunSessionStoreView().setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(health);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(getRunProgressStoreView().runPlayerHealth).toBe(14);
  });

  it("teardownRun clears session flags and returns to menu", () => {
    teardownRun();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(getNavigationStoreView().screen).toBe(ROUTE_SCREENS.MENU);
  });

  it("flushSaveAfterRunEnd persists with no active run", async () => {
    flushSaveAfterRunEnd();
    await vi.waitFor(() => {
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    });
  });

  it("finalizeRunEndSession clears hasActiveRun", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
  });

  it("finalizeRunEndSession ignores a second call after hasActiveRun is cleared", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
  });

  it("applyRunDefeatTeardown commits run and combat teardown together", async () => {
    getRunSessionStoreView().setHasActiveRun(true);
    getBattleStoreView().setHasActiveBattle(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    const finalizeRunXP = vi.fn();
    const clearCombatState = (draft: Parameters<typeof createGameplayDraftActions>[0]) =>
      createGameplayDraftActions(draft).battleActions.setHasActiveBattle(false);
    const clearCombatPresentation = vi.fn();
    const commits: Array<{ hasActiveRun: boolean; hasActiveBattle: boolean }> = [];
    const unsubscribe = subscribeRunSessionCommits(() => {
      commits.push({
        hasActiveRun: getRunSessionStoreView().hasActiveRun,
        hasActiveBattle: getBattleStoreView().hasActiveBattle,
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
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    });
    expect(commits).toEqual([{ hasActiveRun: false, hasActiveBattle: false }]);
    expect(clearCombatPresentation).toHaveBeenCalledOnce();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});
