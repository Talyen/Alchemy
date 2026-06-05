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
import { flattenRunSessionForScreens } from "@/features/alchemy/stores/run-screen-data";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../helpers/run-domain-store-test";

describe("run-session-facade", () => {
  beforeEach(() => {
    teardownRun();
    getRunProgressStoreView().reset();
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
    expect(getRunProgressStoreView().runPlayerHealth).toBe(health);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(getRunProgressStoreView().runPlayerHealth).toBe(14);
  });

  it("teardownRun clears active run session flags", () => {
    teardownRun();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("getCurrentRunPhase reflects battle screen and hasActiveBattle", () => {
    getBattleStoreView().setHasActiveBattle(true);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("battle");
    getBattleStoreView().setHasActiveBattle(false);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("runLoop");
    expect(getCurrentRunPhase(ROUTE_SCREENS.MENU)).toBe("meta");
  });

  it("getRunSession matches buildActiveRunSnapshotFromStores inputs", () => {
    setRunProgress({ runGold: 33, characterId: "knight" });
    const session = getRunSession(ROUTE_SCREENS.SHOP);
    const snapshot = buildActiveRunSnapshotFromStores(ROUTE_SCREENS.SHOP);
    expect(snapshot.runGold).toBe(session.run.runGold);
    expect(snapshot.characterId).toBe(session.run.characterId);
    expect(snapshot.currentScreen).toBe(session.screen);
  });

  it("buildActiveRunSnapshotFromStores matches explicit snapshot fields", () => {
    setRunProgress({
      characterId: "knight",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
    });
    getRunSessionStoreView().setRewardState((prev) => ({
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
      roomsEncountered: getRunProgressStoreView().roomsEncountered,
      currentAct: getRunProgressStoreView().currentAct,
      destinationIndexInAct: getRunProgressStoreView().destinationIndexInAct,
      completedDestinations: getRunProgressStoreView().completedDestinations,
      runTrinkets: getRunProgressStoreView().runTrinkets,
      encounteredRunEnemyIds: getRunProgressStoreView().encounteredRunEnemyIds,
      selectedDifficulty: getRunProgressStoreView().selectedDifficulty,
      contentSystemType: "campaign",
      labyrinthMap: getRunSessionStoreView().labyrinthMap,
      hasActiveBattle: getBattleStoreView().hasActiveBattle,
      battleState: getBattleStoreView().battleState,
      labyrinthPendingNode: getRunSessionStoreView().activeLabyrinthPendingNode,
      activeLabyrinthModifiers: getRunSessionStoreView().activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: getRunSessionStoreView().activeLabyrinthRewardModifiers,
      runTalentXP: getRunProgressStoreView().runTalentXP,
      currentScreen: ROUTE_SCREENS.DESTINATION,
      destinationChoices: ["campfire", "shop"],
    });
    expect(fromStores).toEqual(explicit);
  });

  it("restoreActiveRunToStores hydrates run and session stores", () => {
    teardownRun();
    getRunProgressStoreView().reset();
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
    expect(getRunProgressStoreView().characterId).toBe("wizard");
    expect(getRunProgressStoreView().runGold).toBe(3);
    expect(getNavigationStoreView().screen).toBe(ROUTE_SCREENS.DESTINATION);
    expect(getRunSessionStoreView().hasActiveRun).toBe(true);
    expect(getRunSessionStoreView().rewardState.destinations).toEqual(["campfire"]);
  });
});
