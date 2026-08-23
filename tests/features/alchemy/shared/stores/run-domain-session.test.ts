import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState } from "@/lib/active-run-session";
import {
  applyRunDefeatTeardown,
  finalizeRunEndSession,
  syncBattleToRun as mutateBattleToRun,
  syncRunToBattleStart as mutateRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle } from "@/features/alchemy/shared/stores/write-port-battle";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { emptyInventory } from "@/lib/homestead/inventory";

const syncBattleToRun = createRunSessionCommand(mutateBattleToRun);
const syncRunToBattleStart = createRunSessionCommand(mutateRunToBattleStart);

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
      resultState: { ...resultState, rng: expect.any(Function) },
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

  it("finalizeRunEndSession clears hasActiveRun", async () => {
    getRunSessionStoreView().setHasActiveRun(true);
    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    await vi.waitFor(() => {
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    });
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
    const clearCombatState = (draft: GameplayDraft) => setHasActiveBattle(draft, false);
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
