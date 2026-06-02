import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import {
  getCombinedRunGold,
  getRunSessionSnapshot,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/stores/run-session-facade";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";

describe("run-session-facade", () => {
  beforeEach(() => {
    teardownRun();
    useRunStore.getState().reset();
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

  it("getRunSessionSnapshot aggregates run, battle, and session fields", () => {
    const snapshot = getRunSessionSnapshot();
    expect(snapshot.runPlayerHealth).toBe(18);
    expect(snapshot.runGold).toBe(40);
    expect(snapshot.battleState.playerHealth).toBe(10);
    expect(snapshot.hasActiveRun).toBe(true);
  });

  it("getCombinedRunGold sums map and combat gold", () => {
    expect(getCombinedRunGold()).toBe(47);
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

  it("teardownRun clears active run session flags", () => {
    teardownRun();
    expect(useRunSessionStore.getState().hasActiveRun).toBe(false);
    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
  });
});
