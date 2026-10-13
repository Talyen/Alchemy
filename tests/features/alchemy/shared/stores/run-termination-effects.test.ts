import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { createPlaythroughController } from "@/app/playthrough/controller";
import {
  clearBattlePresentationUi,
  onClearBattlePresentation,
  onRunTeardown,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-lifecycle";
import { completeRunDefeat, completeRunVictory } from "@/features/alchemy/run-loop/run/run-end-commands";
import { readActiveRunScreen, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { registerErrorSink, type LogEntry } from "@/lib/error-logger";
import type { GameSessionOptions } from "@/features/alchemy/shared/stores/game-session-types";
import { SAVE_KEY } from "@/lib/game-constants";

const sessions: Array<ReturnType<typeof createGameSession>> = [];
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.dispose()));
  vi.restoreAllMocks();
});

function start(feedback: GameSessionOptions["feedback"] = {}) {
  const bytes = new Map<string, string>();
  const session = createGameSession({
    runtimeInputs: { generateRunSeed: () => 7 },
    feedback,
    saveBackend: {
      writeSync: () => null,
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async (key, value) => {
        bytes.set(key, value);
        return { ok: true };
      },
      clear: async () => ({ ok: true }),
    },
  });
  sessions.push(session);
  const controller = createPlaythroughController(session);
  controller.flow.goToScreen("game-mode-select");
  controller.flow.beginCampaign();
  controller.flow.handleCharacterSelect("knight");
  return { session, controller, bytes, persistence: createSessionPersistence(session) };
}

function fail(message: string) {
  return () => {
    throw new Error(message);
  };
}

it("End Run saves the committed ending and reaches its recap despite failed audio, UI and lifecycle listeners", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const errors: LogEntry[] = [];
  const releaseLog = registerErrorSink((entry) => errors.push(entry));
  const { session, controller, bytes, persistence } = start({
    stopAllSfx: fail("audio failed"),
    clearBattleUi: fail("UI failed"),
  });
  const cancelled = vi.fn();
  const cleared = vi.fn();
  onClearBattlePresentation(fail("presentation failed"), session);
  onClearBattlePresentation(cleared, session);
  onRunTeardown(fail("teardown failed"), session);
  onRunTeardown(cancelled, session);
  try {
    expect(() => controller.flow.handleAbandonRun()).not.toThrow();
    await persistence.waitForWrites();
    expect(readRunSession(session)).toMatchObject({ hasActiveRun: false, runRecap: { ending: "abandoned" } });
    expect(cleared).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(JSON.parse(bytes.get(SAVE_KEY)!)).toMatchObject({ activeRun: null });
    expect(readActiveRunScreen(session)).toBe("game-over");
    expect(errors.map((entry) => (entry.cause as Error)?.message)).toEqual(
      expect.arrayContaining(["audio failed", "UI failed", "presentation failed", "teardown failed"]),
    );
  } finally {
    releaseLog();
  }
});

it("defeat clears presentation and notifies teardown even if stopping sound or defeat feedback fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { session, bytes, persistence } = start({
    stopAllSfx: fail("audio failed"),
    playDefeat: fail("defeat sound failed"),
  });
  const cleared = vi.fn();
  const cancelled = vi.fn();
  onClearBattlePresentation(cleared, session);
  onRunTeardown(cancelled, session);
  expect(() => completeRunDefeat(session)).not.toThrow();
  await persistence.waitForWrites();
  expect(readRunSession(session)).toMatchObject({ hasActiveRun: false, runRecap: { ending: "death" } });
  expect(cleared).toHaveBeenCalledOnce();
  expect(cancelled).toHaveBeenCalledOnce();
  expect(JSON.parse(bytes.get(SAVE_KEY)!)).toMatchObject({ activeRun: null });
});

it("teardown clears presentation and uses a fixed listener snapshot for each notification", () => {
  const { session } = start();
  const later = vi.fn();
  const added = vi.fn();
  let removeLater = () => {};
  onClearBattlePresentation(() => {
    removeLater();
    onClearBattlePresentation(added, session);
  }, session);
  removeLater = onClearBattlePresentation(later, session);
  const cancelled = vi.fn();
  onRunTeardown(cancelled, session);
  teardownRun(session);
  expect(later).toHaveBeenCalledOnce();
  expect(added).not.toHaveBeenCalled();
  expect(cancelled).toHaveBeenCalledOnce();
  clearBattlePresentationUi(session);
  expect(later).toHaveBeenCalledOnce();
  expect(added).toHaveBeenCalledOnce();
});

it("a broken run-start sound cannot prevent opening combat or subsequent accepted player actions", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { session, controller } = start({ playUISound: fail("sound unavailable") });
  expect(readActiveRunScreen(session)).toBe("battle");
  expect(readRunSession(session).activity.kind).toBe("battle");
  expect(controller.battle.endTurn()).not.toBeNull();
});

it.each(["abandoned", "death", "victory"] as const)(
  "%s captures only new hero unlocks, preserves saved progress and clears the reveal on the next run",
  async (ending) => {
    const { session, controller, bytes, persistence } = start();
    const end = () => {
      if (ending === "abandoned") controller.flow.handleAbandonRun();
      else if (ending === "death") completeRunDefeat(session);
      else completeRunVictory(session);
    };
    end();
    expect(readRunSession(session).runEndUnlockedCharacters).toEqual(["rogue"]);
    await persistence.waitForWrites();
    const save = JSON.parse(bytes.get(SAVE_KEY)!);
    expect(save.finishedRunCharacters).toContain("knight");
    expect(save.activeRun).toBeNull();
    expect(save).not.toHaveProperty("runEndUnlockedCharacters");

    controller.flow.continueFromRunEnd();
    controller.flow.goToScreen("game-mode-select");
    controller.flow.beginCampaign();
    controller.flow.handleCharacterSelect("knight");
    expect(readRunSession(session).runEndUnlockedCharacters).toEqual([]);
    end();
    expect(readRunSession(session).runEndUnlockedCharacters).toEqual([]);
  },
);
