import { afterEach, describe, expect, it, vi } from "vitest";
import { createSaveBackend } from "../../../../helpers/save-backend";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { selectGameBoard, acknowledgeGameBoardReward } from "@/features/alchemy/shared/stores/board-commands";
import { initializeBattle, unlockAllBoards } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  completeRunVictory,
  completeRunDefeat,
  abandonCurrentRun,
} from "@/features/alchemy/run-loop/run/run-end-commands";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { boardCatalog, STARTER_BOARD_ID } from "@/lib/boards/catalog";
import { SaveDataSchema } from "@/lib/validation";
import { battleSnapshot, defaultBattleState } from "@/lib/battle";
import { getStartingDeck } from "@/lib/game-data";

const sessions: GameSession[] = [];
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.dispose();
});
function career(completed = 5, mode: "campaign" | "labyrinth" | "wildwood" = "campaign") {
  const random = vi.fn(() => 0);
  const session = createGameSession({
    runtimeInputs: { cosmeticRandom: random, generateRunSeed: () => 42 },
    saveBackend: createSaveBackend(),
  });
  sessions.push(session);
  dispatchGameplayCommand(
    (draft) => {
      draft.run.initialized = true;
      draft.run.activeRun.contentSystemType = mode;
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.run.activeRun.runHistory = Array.from({ length: completed + 1 }, (_, index) => ({
        id: `room-${index}`,
        destination: "Normal Combat",
        act: 1,
        floor: null,
        completed: index < completed,
      }));
      draft.session.activity = { kind: "battle", data: { battleState: battleSnapshot(defaultBattleState()) } };
      return acceptCommand();
    },
    undefined,
    session,
  );
  return { session, random };
}
function profile(session: GameSession) {
  return readGameplayState(session).profile;
}

it.each(["campaign", "labyrinth", "wildwood"] as const)(
  "awards once after five completed rooms in %s, preserving world RNG",
  async (mode) => {
    const { session, random } = career(5, mode);
    const rng = structuredClone(readGameplayState(session).run.activeRun.rng);
    const persistence = createSessionPersistence(session);
    completeRunVictory(session);
    const receipt = profile(session).pendingBoardRewardId;
    expect(receipt).not.toBeNull();
    expect(receipt).not.toBe(STARTER_BOARD_ID);
    expect(profile(session).collectedBoardIds).toEqual([STARTER_BOARD_ID, receipt]);
    expect(readGameplayState(session).run.activeRun.rng).toEqual(rng);
    completeRunVictory(session);
    expect(random).toHaveBeenCalledOnce();
    await persistence.waitForWrites();
    const saved = SaveDataSchema.parse(buildAlchemySaveDataFromStores(session));
    expect(saved.activeRun).toBeNull();
    const restored = createGameSession({ initialSave: saved, saveBackend: createSaveBackend() });
    sessions.push(restored);
    completeRunVictory(restored);
    expect(profile(restored).collectedBoardIds).toEqual(saved.collectedBoardIds);
    expect(profile(restored).pendingBoardRewardId).toBe(receipt);
    expect(acknowledgeGameBoardReward(receipt!, true, restored)).toBe(true);
    expect(profile(restored).boardSelection).toEqual({ kind: "board", boardId: receipt });
    expect(profile(restored).pendingBoardRewardId).toBeNull();
    expect(acknowledgeGameBoardReward(receipt!, true, restored)).toBe(false);
  },
);

it.each([
  [4, completeRunVictory, 1],
  [5, completeRunDefeat, 2],
  [30, completeRunVictory, 2],
  [30, abandonCurrentRun, 1],
] as const)("settles a run with %i completed rooms with the expected board count", (rooms, end, count) => {
  const { session } = career(rooms);
  end(session);
  expect(profile(session).collectedBoardIds).toHaveLength(count);
});

it("unlocks the whole catalog for development without changing selection, and exhausted runs have no reveal", () => {
  const { session, random } = career();
  selectGameBoard({ kind: "none" }, session);
  dispatchGameplayCommand((draft) => acceptCommand(unlockAllBoards(draft)), undefined, session);
  completeRunDefeat(session);
  expect(profile(session).collectedBoardIds).toEqual(boardCatalog.map((board) => board.id));
  expect(profile(session).boardSelection).toEqual({ kind: "none" });
  expect(profile(session).pendingBoardRewardId).toBeNull();
  expect(random).not.toHaveBeenCalled();
});

it("rejects locked boards and applies accepted selections to a live battle without changing combat", () => {
  const { session } = career();
  const battle = readGameplayState(session).session.activity;
  expect(selectGameBoard({ kind: "board", boardId: "alpine-cuckoo" }, session)).toBe(false);
  expect(profile(session).activeBoardId).toBe(STARTER_BOARD_ID);
  expect(selectGameBoard({ kind: "none" }, session)).toBe(true);
  expect(profile(session).activeBoardId).toBeNull();
  expect(readGameplayState(session).session.activity).toBe(battle);
});

it("random selection avoids repeats, remains stable through resume, and changes only at a new battle", () => {
  const { session, random } = career();
  dispatchGameplayCommand(
    (draft) => {
      draft.profile.collectedBoardIds.push("alpine-cuckoo");
      return acceptCommand();
    },
    undefined,
    session,
  );
  selectGameBoard({ kind: "random" }, session);
  const first = profile(session).activeBoardId;
  selectGameBoard({ kind: "random" }, session);
  expect(profile(session).activeBoardId).toBe(first);
  expect(random).toHaveBeenCalledOnce();
  const saved = SaveDataSchema.parse(buildAlchemySaveDataFromStores(session));
  const restoredRandom = vi.fn(() => 0);
  const restored = createGameSession({
    initialSave: saved,
    saveBackend: createSaveBackend(),
    runtimeInputs: { cosmeticRandom: restoredRandom },
  });
  sessions.push(restored);
  expect(profile(restored).activeBoardId).toBe(first);
  expect(restoredRandom).not.toHaveBeenCalled();
  dispatchGameplayCommand(
    (draft) => {
      draft.session.activity = { kind: "destination" };
      return acceptCommand(initializeBattle(draft, { kind: "battle", options: { enemyId: "skeleton" } }));
    },
    undefined,
    restored,
  );
  expect(profile(restored).activeBoardId).not.toBe(first);
  expect(restoredRandom).toHaveBeenCalledOnce();
});

it("continuing the reveal leaves None selected and persists acknowledgment", () => {
  const { session } = career();
  selectGameBoard({ kind: "none" }, session);
  completeRunDefeat(session);
  expect(acknowledgeGameBoardReward(profile(session).pendingBoardRewardId!, false, session)).toBe(true);
  const saved = SaveDataSchema.parse(buildAlchemySaveDataFromStores(session));
  expect(saved.boardSelection).toEqual({ kind: "none" });
  expect(saved.pendingBoardRewardId).toBeNull();
  expect(saved.collectedBoardIds).toHaveLength(2);
});

describe("board save recovery", () => {
  it("supplies starter defaults to saves without board fields", () => {
    const saved = SaveDataSchema.parse({});
    expect(saved.collectedBoardIds).toEqual([STARTER_BOARD_ID]);
    expect(saved.boardSelection).toEqual({ kind: "board", boardId: STARTER_BOARD_ID });
    expect(saved.activeBoardId).toBe(STARTER_BOARD_ID);
  });
  it("drops unknown IDs and repairs locked selections without erasing owned boards", () => {
    const saved = SaveDataSchema.parse({
      collectedBoardIds: ["alpine-cuckoo", "alpine-cuckoo", "obsolete", 7],
      boardSelection: { kind: "board", boardId: "amethyst-lantern" },
      activeBoardId: "amethyst-lantern",
      lastRandomBoardId: "obsolete",
      pendingBoardRewardId: "amethyst-lantern",
    });
    expect(saved.collectedBoardIds).toEqual([STARTER_BOARD_ID, "alpine-cuckoo"]);
    expect(saved.boardSelection).toEqual({ kind: "board", boardId: STARTER_BOARD_ID });
    expect(saved.activeBoardId).toBe(STARTER_BOARD_ID);
    expect(saved.lastRandomBoardId).toBeNull();
    expect(saved.pendingBoardRewardId).toBeNull();
  });
});
