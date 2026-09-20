import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { defaultBattleState } from "@/lib/battle";
import { parseActiveRun } from "@/lib/active-run-session";
import { createBattleStartCommands } from "@/features/alchemy/run-loop/battle/battle-start-commands";
import { gridLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";
import { getStartingDeck } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import { dispatchRunSessionCommand as command } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession, readCardInspectionData } from "@/features/alchemy/shared/stores/run-reads";
import {
  abandonRun,
  applyRunDefeatTeardown,
  restoreRun,
  snapshotRun,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-materials";
import {
  addGold,
  grantStartGold,
  deductGold,
  setGold,
  setHasActiveRun,
  initializeActiveBattle,
  commitBattleTransition,
  recordRunRoom,
  completeRunRoom,
  finalizeRunXP,
  setHasActiveBattle,
  setRewardState,
  beginDestinationClaim,
  commitDestinationClaim,
  setCurrentAct,
  setCompletedDestinations,
  setDestinationIndexInAct,
  setScreen,
  setLabyrinthMap,
  setActiveLabyrinthPendingNode,
  abandonCorruptionDestinationVisit,
  abandonMysteryDestinationVisit,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";

const endOptions = { awardRunEndMaterials, finalizeRunXP };
beforeEach(() => {
  resetRunDomainStore();
  command((draft) => setHasActiveRun(draft, true));
});

describe("run recap", () => {
  it("counts grants and committed battle Gold once, excluding starting purse and spending across resume", () => {
    command((draft) => {
      setGold(draft, 500);
      grantStartGold(draft, 30);
      addGold(draft, 20);
      deductGold(draft, 100);
      initializeActiveBattle(draft, { ...defaultBattleState(), gold: 450 });
      commitBattleTransition(draft, { ...draft.battle.battleState, gold: 457 }, null);
      commitBattleTransition(draft, { ...draft.battle.battleState }, null);
    });
    expect(readActiveRun().runGoldEarned).toBe(27);
    const saved = parseActiveRun(snapshotRun())!;
    expect(saved.runGoldEarned).toBe(27);
    restoreRun(saved, {}, {});
    expect(readActiveRun().runGoldEarned).toBe(27);
    command((draft) => addGold(draft, 5));
    abandonRun(endOptions);
    expect(readRunSession().runRecap?.gold).toBe(32);
    expect(abandonRun(endOptions)).toBe(false);
    expect(readRunSession().runRecap?.gold).toBe(32);
  });

  it("keeps campaign room order across acts without duplicating claims", () => {
    command((draft) => {
      setRewardState(draft, (state) => ({ ...state, destinations: [DESTINATIONS.CAMPFIRE] }));
      beginDestinationClaim(draft, DESTINATIONS.CAMPFIRE);
      expect(commitDestinationClaim(draft, DESTINATIONS.CAMPFIRE)).toBe(true);
      expect(commitDestinationClaim(draft, DESTINATIONS.CAMPFIRE)).toBe(false);
      completeRunRoom(draft);
      setCurrentAct(draft, 2);
      setCompletedDestinations(draft, []);
      setDestinationIndexInAct(draft, 0);
      setRewardState(draft, (state) => ({ ...state, destinations: [DESTINATIONS.BOSS_COMBAT] }));
      beginDestinationClaim(draft, DESTINATIONS.BOSS_COMBAT);
      commitDestinationClaim(draft, DESTINATIONS.BOSS_COMBAT);
    });
    const saved = parseActiveRun(snapshotRun())!;
    expect(saved.runHistory.map((room) => [room.act, room.destination, room.completed])).toEqual([
      [1, DESTINATIONS.CAMPFIRE, true],
      [2, DESTINATIONS.BOSS_COMBAT, false],
    ]);
    restoreRun(saved, {}, {});
    applyRunDefeatTeardown({ ...endOptions, clearCombatState: (draft) => setHasActiveBattle(draft, false) });
    expect(readRunSession().runRecap).toMatchObject({ ending: "death", rooms: saved.runHistory });
  });

  it("preserves a detached deck and Boon snapshot after voluntary ending", () => {
    command((draft) => {
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.run.activeRun.runBoons = ["bone-charm"];
      recordRunRoom(draft, DESTINATIONS.NORMAL_COMBAT, "first");
    });
    abandonRun(endOptions);
    command((draft) => {
      draft.run.activeRun.runDeck = [];
      draft.run.activeRun.runBoons = [];
      setScreen(draft, "game-over");
    });
    expect(readCardInspectionData().runDeck.length).toBeGreaterThan(0);
    expect(readRunSession().runRecap).toMatchObject({ ending: "abandoned", boons: ["bone-charm"] });
  });

  it("uses honest unknown totals for older saves while continuing to record subsequent rooms", () => {
    const { runHistory: _history, runHistoryPartial: _partial, runGoldEarned: _gold, ...old } = snapshotRun();
    const restored = parseActiveRun(old)!;
    expect(restored).toMatchObject({ runHistory: [], runHistoryPartial: true, runGoldEarned: null });
    restoreRun(restored, {}, {});
    command((draft) => {
      addGold(draft, 20);
      recordRunRoom(draft, DESTINATIONS.CAMPFIRE, "new");
      recordRunRoom(draft, DESTINATIONS.CAMPFIRE, "new");
    });
    abandonRun(endOptions);
    expect(readRunSession().runRecap).toMatchObject({ gold: null, partial: true });
    expect(readRunSession().runRecap?.rooms).toHaveLength(1);
  });
});

it("records distinct Wildwood boss attempts and keeps the trail through resume", () => {
  command((draft) => {
    draft.run.activeRun.contentSystemType = "wildwood";
    draft.session.wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "battle",
      currentBossId: "forge-golem",
    };
  });
  const battle = createBattleStartCommands(() => {});
  battle.startBossById("forge-golem");
  command((draft) => completeRunRoom(draft));
  battle.startBossById("forge-golem");
  const saved = parseActiveRun(snapshotRun())!;
  expect(saved.runHistory.map((room) => [room.destination, room.completed])).toEqual([
    [DESTINATIONS.BOSS_COMBAT, true],
    [DESTINATIONS.BOSS_COMBAT, false],
  ]);
  restoreRun(saved, {}, {});
  expect(readActiveRun().runHistory).toEqual(saved.runHistory);
});

it("deduplicates unresolved Labyrinth rooms and completes the revisited room rather than the last entry", () => {
  command((draft) => {
    draft.run.activeRun.contentSystemType = "labyrinth";
    setLabyrinthMap(draft, gridLabyrinthMapFixture());
    const first = "labyrinth-floor-1-n0";
    const second = "labyrinth-floor-1-n1";
    recordRunRoom(draft, DESTINATIONS.CORRUPTION, `labyrinth:1:${first}`);
    recordRunRoom(draft, DESTINATIONS.CARD_SHOP, `labyrinth:1:${second}`);
    recordRunRoom(draft, DESTINATIONS.CORRUPTION, `labyrinth:1:${first}`);
    setActiveLabyrinthPendingNode(draft, first);
    completeRunRoom(draft);
  });
  expect(readActiveRun().runHistory.map((room) => [room.floor, room.completed])).toEqual([
    [1, true],
    [1, false],
  ]);
  abandonRun(endOptions);
  expect(readRunSession().runRecap?.endingRoomId).toBe("labyrinth:1:labyrinth-floor-1-n0");
});

it("completes and marks a revisited campaign room by identity", () => {
  command((draft) => {
    const enter = (destination: typeof DESTINATIONS.CORRUPTION | typeof DESTINATIONS.MYSTERY) => {
      setRewardState(draft, (state) => ({ ...state, destinations: [destination] }));
      beginDestinationClaim(draft, destination);
      commitDestinationClaim(draft, destination);
    };
    enter(DESTINATIONS.CORRUPTION);
    abandonCorruptionDestinationVisit(draft);
    enter(DESTINATIONS.MYSTERY);
    abandonMysteryDestinationVisit(draft);
    enter(DESTINATIONS.CORRUPTION);
    completeRunRoom(draft);
  });
  expect(readActiveRun().runHistory.map((room) => room.completed)).toEqual([true, false]);
  abandonRun(endOptions);
  expect(readRunSession().runRecap?.endingRoomId).toBe(`campaign:1:1:${DESTINATIONS.CORRUPTION}`);
});
