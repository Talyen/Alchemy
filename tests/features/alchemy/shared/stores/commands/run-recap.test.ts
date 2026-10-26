import { setRunProgressActivity } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import "../../../../../helpers/mock-audio";

import "../../../../../helpers/mock-flush-save";
import {
  mutateGameplayForTest,
  initializeBattleForTest as initializeActiveBattle,
  getBattleForTest,
} from "../../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { defaultBattleState } from "@/lib/battle";
import { parseActiveRun, SaveDataSchema } from "@/lib/validation";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/commands/battle-start-commands";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";
import { getStartingDeck } from "@/lib/game-data";
import { DESTINATIONS } from "@/lib/routing";
import {
  readActiveRun,
  readRunSession,
  readCardInspectionData,
  readRunProfile,
} from "@/features/alchemy/shared/stores/session/run-reads";
import {
  abandonRun,
  applyRunDefeatTeardown,
  restoreRun,
  snapshotRun,
} from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import {
  addGold,
  deductGold,
  setGold,
  setHasActiveRun,
  recordRunRoom,
  completeRunRoom,
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
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { setBattleState } from "@/features/alchemy/shared/stores/commands/write/run-battle";
import { resetRunDomainStore } from "../../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
  mutateGameplayForTest((draft) => {
    setHasActiveRun(draft, true);
    setRunProgressActivity(draft, "destination");
  });
});

describe("run recap", () => {
  it("keeps a nearly full purse saveable when a noncombat reward is awarded", () => {
    mutateGameplayForTest((draft) => {
      setGold(draft, Number.MAX_SAFE_INTEGER - 1);
      addGold(draft, 20);
    });
    const { gold } = readRunProfile(defaultGameSession);
    expect(SaveDataSchema.parse({ gold }).gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(readActiveRun(defaultGameSession).runGoldEarned).toBe(1);
  });

  it("preserves a full run Gold tally across the next award and resume", () => {
    mutateGameplayForTest((draft) => {
      draft.run.activeRun.runGoldEarned = Number.MAX_SAFE_INTEGER;
      addGold(draft, 1);
    });
    expect(parseActiveRun(snapshotRun(defaultGameSession))?.runGoldEarned).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("counts grants and committed battle Gold once, excluding starting purse and spending across resume", () => {
    mutateGameplayForTest((draft) => {
      setGold(draft, 530);
      addGold(draft, 20);
      deductGold(draft, 100);
      initializeActiveBattle(draft, { ...defaultBattleState(), gold: 450 });
      setBattleState(draft, { ...getBattleForTest(draft).battleState, gold: 457 });
      setBattleState(draft, { ...getBattleForTest(draft).battleState });
    });
    expect(readActiveRun(defaultGameSession).runGoldEarned).toBe(27);
    const saved = parseActiveRun(snapshotRun(defaultGameSession))!;
    expect(saved.runGoldEarned).toBe(27);
    restoreRun(saved, {}, {}, defaultGameSession);
    expect(readActiveRun(defaultGameSession).runGoldEarned).toBe(27);
    mutateGameplayForTest((draft) => addGold(draft, 5));
    abandonRun(defaultGameSession);
    expect(readRunSession(defaultGameSession).runRecap?.gold).toBe(32);
    expect(abandonRun(defaultGameSession)).toBe(false);
    expect(readRunSession(defaultGameSession).runRecap?.gold).toBe(32);
  });

  it("keeps campaign room order across acts without duplicating claims", () => {
    mutateGameplayForTest((draft) => {
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
    const saved = parseActiveRun(snapshotRun(defaultGameSession))!;
    expect(saved.runHistory.map((room) => [room.act, room.destination, room.completed])).toEqual([
      [1, DESTINATIONS.CAMPFIRE, true],
      [2, DESTINATIONS.BOSS_COMBAT, false],
    ]);
    restoreRun(saved, {}, {}, defaultGameSession);
    applyRunDefeatTeardown(defaultGameSession);
    expect(readRunSession(defaultGameSession).runRecap).toMatchObject({ ending: "death", rooms: saved.runHistory });
  });

  it("preserves a detached deck and Boon snapshot after voluntary ending", () => {
    mutateGameplayForTest((draft) => {
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.run.activeRun.runBoons = ["bone-charm"];
      recordRunRoom(draft, DESTINATIONS.NORMAL_COMBAT, "first");
    });
    abandonRun(defaultGameSession);
    mutateGameplayForTest((draft) => {
      draft.run.activeRun.runDeck = [];
      draft.run.activeRun.runBoons = [];
      setScreen(draft, "game-over");
    });
    expect(readCardInspectionData(defaultGameSession).runDeck.length).toBeGreaterThan(0);
    expect(readRunSession(defaultGameSession).runRecap).toMatchObject({ ending: "abandoned", boons: ["bone-charm"] });
  });

  it("uses honest unknown totals for older saves while continuing to record subsequent rooms", () => {
    const {
      runHistory: _history,
      runHistoryPartial: _partial,
      runGoldEarned: _gold,
      ...old
    } = snapshotRun(defaultGameSession);
    const restored = parseActiveRun(old)!;
    expect(restored).toMatchObject({ runHistory: [], runHistoryPartial: true, runGoldEarned: null });
    restoreRun(restored, {}, {}, defaultGameSession);
    mutateGameplayForTest((draft) => {
      addGold(draft, 20);
      recordRunRoom(draft, DESTINATIONS.CAMPFIRE, "new");
      recordRunRoom(draft, DESTINATIONS.CAMPFIRE, "new");
    });
    abandonRun(defaultGameSession);
    expect(readRunSession(defaultGameSession).runRecap).toMatchObject({ gold: null, partial: true });
    expect(readRunSession(defaultGameSession).runRecap?.rooms).toHaveLength(1);
  });
});

it("records distinct Wildwood boss attempts and keeps the trail through resume", () => {
  mutateGameplayForTest((draft) => {
    draft.run.activeRun.contentSystemType = "wildwood";
    draft.session.wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "battle",
      currentBossId: "forge-golem",
    };
  });
  const battle = createBattleStartCommands(() => {}, defaultGameSession);
  battle.startBossById({ bossId: "forge-golem" });
  mutateGameplayForTest((draft) => {
    completeRunRoom(draft);
    draft.session.activity = { kind: "idle" };
  });
  battle.startBossById({ bossId: "forge-golem" });
  const saved = parseActiveRun(snapshotRun(defaultGameSession))!;
  expect(saved.runHistory.map((room) => [room.destination, room.completed])).toEqual([
    [DESTINATIONS.BOSS_COMBAT, true],
    [DESTINATIONS.BOSS_COMBAT, false],
  ]);
  restoreRun(saved, {}, {}, defaultGameSession);
  expect(readActiveRun(defaultGameSession).runHistory).toEqual(saved.runHistory);
});

it("deduplicates unresolved Labyrinth rooms and completes the revisited room rather than the last entry", () => {
  mutateGameplayForTest((draft) => {
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
  expect(readActiveRun(defaultGameSession).runHistory.map((room) => [room.floor, room.completed])).toEqual([
    [1, true],
    [1, false],
  ]);
  abandonRun(defaultGameSession);
  expect(readRunSession(defaultGameSession).runRecap?.endingRoomId).toBe("labyrinth:1:labyrinth-floor-1-n0");
});

it("completes and marks a revisited campaign room by identity", () => {
  mutateGameplayForTest((draft) => {
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
  expect(readActiveRun(defaultGameSession).runHistory.map((room) => room.completed)).toEqual([true, false]);
  abandonRun(defaultGameSession);
  expect(readRunSession(defaultGameSession).runRecap?.endingRoomId).toBe(`campaign:1:1:${DESTINATIONS.CORRUPTION}`);
});
