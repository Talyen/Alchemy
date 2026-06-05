import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
vi.mock("@/features/alchemy/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/storage")>();
  return {
    ...actual,
    flushAlchemySaveNow: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/audio", () => ({
  playDefeat: vi.fn(),
  stopAllSfx: vi.fn(),
}));

import { flushAlchemySaveNow } from "@/features/alchemy/storage";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useNavigationStore } from "@/features/alchemy/shared/stores/navigation-store";
import {
  applyRunDefeatTeardown,
  flushSaveAfterRunEnd,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/stores/run-lifecycle-coordinator";

describe("run-lifecycle-coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teardownRun();
    useRunStore.setState({
      runPlayerHealth: 18,
      runMaxHealth: 24,
      runGold: 40,
      initialized: true,
    });
    useBattleStore.getState().setSyncedBattleState({
      ...defaultBattleState(),
      playerHealth: 10,
      gold: 7,
    });
    useRunSessionStore.getState().setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(useRunStore.getState().runPlayerHealth).toBe(health);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(useRunStore.getState().runPlayerHealth).toBe(14);
  });

  it("teardownRun clears active run session flags and returns to menu", () => {
    teardownRun();
    expect(useRunSessionStore.getState().hasActiveRun).toBe(false);
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
    expect(useNavigationStore.getState().screen).toBe(ROUTE_SCREENS.MENU);
  });

  it("flushSaveAfterRunEnd persists with no active run", () => {
    flushSaveAfterRunEnd();
    expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
  });

  it("applyRunDefeatTeardown awards materials, finalizes XP, flushes, and clears combat", () => {
    const awardRunEndMaterials = vi.fn();
    const finalizeRunXP = vi.fn();
    const clearCombatState = vi.fn();

    applyRunDefeatTeardown({ awardRunEndMaterials, finalizeRunXP, clearCombatState });

    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
    expect(finalizeRunXP).toHaveBeenCalledOnce();
    expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    expect(clearCombatState).toHaveBeenCalledOnce();
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});
