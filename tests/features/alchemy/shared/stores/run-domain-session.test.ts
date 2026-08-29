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
import {
  initializeActiveBattle as mutateInitializeActiveBattle,
  setHasActiveBattle as mutateHasActiveBattle,
  setRewardState as mutateRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setSyncedBattleState as mutateSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun as mutateHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { emptyInventory } from "@/lib/homestead/inventory";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";

const syncBattleToRun = createRunSessionCommand(mutateBattleToRun);
const syncRunToBattleStart = createRunSessionCommand(mutateRunToBattleStart);
const initializeActiveBattle = createRunSessionCommand(mutateInitializeActiveBattle);
const setSyncedBattleState = createRunSessionCommand(mutateSyncedBattleState);
const setHasActiveBattle = createRunSessionCommand(mutateHasActiveBattle);
const setHasActiveRun = createRunSessionCommand(mutateHasActiveRun);
const setRewardState = createRunSessionCommand(mutateRewardState);

import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import {
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
    expect(readRunSession().shopState.cards).toEqual([]);
    expect(readRunSession().alchemistState.potions).toEqual([]);
  });

  it("starts with empty reward state and no active run", () => {
    expect(readRunSession().rewardState).toEqual(createEmptyRewardState());
    expect(readRunSession().hasActiveRun).toBe(false);
  });

  it("setRewardState accepts direct values and updaters", () => {
    setRewardState({ ...createEmptyRewardState(), gold: 50 });
    expect(readRunSession().rewardState.gold).toBe(50);
    setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(readRunSession().rewardState.gold).toBe(75);
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
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(readActiveRun().runPlayerHealth).toBe(health);
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
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    });
  });

  it("finalizeRunEndSession ignores a second call after hasActiveRun is cleared", () => {
    setHasActiveRun(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() });
    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
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
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    });
    expect(commits).toEqual([{ hasActiveRun: false, hasActiveBattle: false }]);
    expect(clearCombatPresentation).toHaveBeenCalledOnce();
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});
