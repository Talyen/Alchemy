import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import {
  setBattleActiveForTest as mutateHasActiveBattle,
  replaceBattleForTest as mutateSyncedBattleState,
} from "../../../../helpers/run-domain-store-test";
import { awardRunEndMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { saveAlchemySaveData } from "@/features/alchemy/shared/storage";

import { createGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { subscribeGameplayCommits } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  abandonRun,
  applyRunDefeatTeardown,
  finalizeRunEndSession,
  syncBattleToRun as mutateBattleToRun,
  syncRunToBattleStart as mutateRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  finalizeRunXP as mutateFinalizeRunXP,
  setHasActiveRun as mutateHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-write-port";

import { createEmptyRewardState, readActivityData } from "@/lib/active-run-session";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { defaultBattleState } from "@/lib/battle";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ROUTE_SCREENS } from "@/lib/routing";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRunDomainStore, resetRunSessionSlice, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";
const syncBattleToRun = createRunSessionCommand(
  (...args: Parameters<typeof mutateBattleToRun>) => acceptCommand(mutateBattleToRun(...args)),
  undefined,
  defaultGameSession,
);
const syncRunToBattleStart = createRunSessionCommand(
  (...args: Parameters<typeof mutateRunToBattleStart>) => acceptCommand(mutateRunToBattleStart(...args)),
  undefined,
  defaultGameSession,
);
const setSyncedBattleState = createGameplayCommand(
  (...args: Parameters<typeof mutateSyncedBattleState>) => acceptCommand(mutateSyncedBattleState(...args)),
  undefined,
  defaultGameSession,
);
const setHasActiveBattle = createRunSessionCommand(
  (...args: Parameters<typeof mutateHasActiveBattle>) => acceptCommand(mutateHasActiveBattle(...args)),
  undefined,
  defaultGameSession,
);
const setHasActiveRun = createRunSessionCommand(
  (...args: Parameters<typeof mutateHasActiveRun>) => acceptCommand(mutateHasActiveRun(...args)),
  undefined,
  defaultGameSession,
);

beforeEach(() => {
  resetRunDomainStore();
});

describe("session slice", () => {
  beforeEach(() => {
    resetRunSessionSlice();
  });

  it("has empty shop and alchemist state", () => {
    expect(readActivityData(readRunSession(defaultGameSession).activity, "shop").cards).toEqual([]);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "alchemist").potions).toEqual([]);
  });

  it("starts with empty reward state and no active run", () => {
    expect(readRunSession(defaultGameSession).rewardFlow.state).toEqual(createEmptyRewardState());
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
  });
});

describe("run transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun(defaultGameSession);
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(health);
  });

  it("does not restore Health from Grove's Favor at battle start", () => {
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, runBoons: ["groves-favor"] });

    expect(syncRunToBattleStart()).toBe(18);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(18);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(14);
  });

  it("teardownRun clears session flags and returns to menu", () => {
    teardownRun(defaultGameSession);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(readActiveRunScreen(defaultGameSession)).toBe(ROUTE_SCREENS.MENU);
  });

  it("finalizeRunEndSession clears hasActiveRun", async () => {
    setHasActiveRun(true);
    finalizeRunEndSession(
      {
        awardRunEndMaterials: vi.fn(() => emptyInventory()),
        finalizeRunXP: vi.fn(),
      },
      defaultGameSession,
    );
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    await vi.waitFor(() => {
      expect(saveAlchemySaveData).toHaveBeenCalledWith(
        expect.objectContaining({ activeRun: null }),
        defaultGameSession,
      );
    });
  });

  it("finalizeRunEndSession ignores a second call after hasActiveRun is cleared", () => {
    setHasActiveRun(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() }, defaultGameSession);
    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: vi.fn() }, defaultGameSession);
    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
  });

  it("abandonRun preserves the run-end snapshot for the End Run screen", () => {
    setHasActiveRun(true);
    setHasActiveBattle(true);
    setRunProgress({
      runTalentXP: { physical: 10 },
      runMaterialsEarned: { ...emptyInventory(), wood: 5 },
    });

    const ended = abandonRun({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP }, defaultGameSession);

    expect(ended).toBe(true);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(readRunSession(defaultGameSession).runEndTalentXP.physical).toBeGreaterThan(0);
    expect(readRunSession(defaultGameSession).runEndMaterials.wood).toBe(5);
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");

    expect(abandonRun({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP }, defaultGameSession)).toBe(false);
  });

  it("applyRunDefeatTeardown commits run and combat teardown together", async () => {
    setHasActiveRun(true);
    setHasActiveBattle(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    const finalizeRunXP = vi.fn();
    const clearCombatPresentation = vi.fn();
    const commits: Array<{ hasActiveRun: boolean; hasActiveBattle: boolean }> = [];
    const unsubscribe = subscribeRunSessionCommits(() => {
      commits.push({
        hasActiveRun: readRunSession(defaultGameSession).hasActiveRun,
        hasActiveBattle: readBattle(defaultGameSession).hasActiveBattle,
      });
    }, defaultGameSession);

    applyRunDefeatTeardown(
      {
        awardRunEndMaterials,
        finalizeRunXP,
        clearCombatPresentation,
      },
      defaultGameSession,
    );
    unsubscribe();

    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
    expect(finalizeRunXP).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(saveAlchemySaveData).toHaveBeenCalledWith(
        expect.objectContaining({ activeRun: null }),
        defaultGameSession,
      );
    });
    expect(commits).toEqual([{ hasActiveRun: false, hasActiveBattle: false }]);
    expect(clearCombatPresentation).toHaveBeenCalledOnce();
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
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
    const unsubscribeSession = subscribeRunSessionCommits(() => calls.push("session"), defaultGameSession);
    const unsubscribeGameplay = subscribeGameplayCommits(() => calls.push("gameplay"), defaultGameSession);
    setHasActiveBattle(true);
    unsubscribeSession();
    unsubscribeGameplay();
    expect(calls).toEqual(["session", "gameplay"]);
  });
});
