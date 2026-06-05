import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createActiveRunSnapshot } from "@/lib/active-run-session";
import {
  buildActiveRunSnapshotFromStores,
  getCombinedRunGold,
  getCurrentRunPhase,
  getRunSession,
  restoreActiveRunToStores,
  syncBattleToRun,
  syncRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/stores/run-session-facade";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { flattenRunSessionForScreens } from "@/features/alchemy/stores/run-screen-data";
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

  it("flattenRunSessionForScreens aggregates run, battle, and session fields", () => {
    const flat = flattenRunSessionForScreens(getRunSession(ROUTE_SCREENS.MENU));
    expect(flat.runPlayerHealth).toBe(18);
    expect(flat.runGold).toBe(40);
    expect(flat.battleState.playerHealth).toBe(10);
    expect(flat.hasActiveRun).toBe(true);
    expect(flat.phase).toBe("meta");
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

  it("getCurrentRunPhase reflects battle screen and hasActiveBattle", () => {
    useBattleStore.getState().setHasActiveBattle(true);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("battle");
    useBattleStore.getState().setHasActiveBattle(false);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("runLoop");
    expect(getCurrentRunPhase(ROUTE_SCREENS.MENU)).toBe("meta");
  });

  it("getRunSession matches buildActiveRunSnapshotFromStores inputs", () => {
    useRunStore.setState({ runGold: 33, characterId: "knight" });
    const session = getRunSession(ROUTE_SCREENS.SHOP);
    const snapshot = buildActiveRunSnapshotFromStores(ROUTE_SCREENS.SHOP);
    expect(snapshot.runGold).toBe(session.run.runGold);
    expect(snapshot.characterId).toBe(session.run.characterId);
    expect(snapshot.currentScreen).toBe(session.screen);
  });

  it("buildActiveRunSnapshotFromStores matches explicit snapshot fields", () => {
    useRunStore.setState({
      characterId: "knight",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
    });
    useRunSessionStore.getState().setRewardState((prev) => ({
      ...prev,
      destinations: ["campfire", "shop"],
    }));
    const fromStores = buildActiveRunSnapshotFromStores(ROUTE_SCREENS.DESTINATION);
    const explicit = createActiveRunSnapshot({
      characterId: "knight",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      roomsEncountered: useRunStore.getState().roomsEncountered,
      currentAct: useRunStore.getState().currentAct,
      destinationIndexInAct: useRunStore.getState().destinationIndexInAct,
      completedDestinations: useRunStore.getState().completedDestinations,
      runTrinkets: useRunStore.getState().runTrinkets,
      encounteredRunEnemyIds: useRunStore.getState().encounteredRunEnemyIds,
      selectedDifficulty: useRunStore.getState().selectedDifficulty,
      contentSystemType: "campaign",
      labyrinthMap: useRunSessionStore.getState().labyrinthMap,
      hasActiveBattle: useBattleStore.getState().hasActiveBattle,
      battleState: useBattleStore.getState().battleState,
      labyrinthPendingNode: useRunSessionStore.getState().activeLabyrinthPendingNode,
      activeLabyrinthModifiers: useRunSessionStore.getState().activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: useRunSessionStore.getState().activeLabyrinthRewardModifiers,
      runTalentXP: useRunStore.getState().runTalentXP,
      currentScreen: ROUTE_SCREENS.DESTINATION,
      destinationChoices: ["campfire", "shop"],
    });
    expect(fromStores).toEqual(explicit);
  });

  it("restoreActiveRunToStores hydrates run and session stores", () => {
    teardownRun();
    useRunStore.getState().reset();
    const activeRun = createActiveRunSnapshot({
      characterId: "wizard",
      runDeck: [],
      runGold: 3,
      runPlayerHealth: 15,
      runMaxHealth: 20,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      encounteredRunEnemyIds: [],
      selectedDifficulty: "normal",
      contentSystemType: "campaign",
      labyrinthMap: null,
      hasActiveBattle: false,
      battleState: defaultBattleState(),
      labyrinthPendingNode: null,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
      runTalentXP: {},
      currentScreen: ROUTE_SCREENS.DESTINATION,
      destinationChoices: ["campfire"],
    });
    restoreActiveRunToStores(activeRun, {}, {});
    expect(useRunStore.getState().characterId).toBe("wizard");
    expect(useRunStore.getState().runGold).toBe(3);
    expect(useRunSessionStore.getState().hasActiveRun).toBe(true);
    expect(useRunSessionStore.getState().rewardState.destinations).toEqual(["campfire"]);
  });
});
