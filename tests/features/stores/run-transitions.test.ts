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
import {
  applyRunDefeatTeardown,
  flushSaveAfterRunEnd,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/stores/run-transitions";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
} from "../../helpers/run-domain-store-test";

describe("run-transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun();
    setRunProgress({
      runPlayerHealth: 18,
      runMaxHealth: 24,
      runGold: 40,
      initialized: true,
    });
    getBattleStoreView().setSyncedBattleState({
      ...defaultBattleState(),
      playerHealth: 10,
      gold: 7,
    });
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

  it("teardownRun clears active run session flags and returns to menu", () => {
    teardownRun();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(getNavigationStoreView().screen).toBe(ROUTE_SCREENS.MENU);
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
