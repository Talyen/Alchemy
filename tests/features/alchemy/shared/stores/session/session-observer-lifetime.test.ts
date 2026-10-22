import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session/session-runtime";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/session/notification-channel";

it("revokes both the current observer snapshot and queued reentrant publications", () => {
  let active = true;
  const stale = vi.fn();
  const channel = createNotificationChannel<[number]>(
    () => {},
    () => active,
  );
  const first = vi.fn((revision: number) => {
    if (revision === 1) {
      channel.publish(2);
      active = false;
    }
  });
  channel.subscribe(first);
  channel.subscribe(stale);
  channel.publish(1);
  channel.publish(3);
  expect(first).toHaveBeenCalledExactlyOnceWith(1);
  expect(stale).not.toHaveBeenCalled();
});

it.each(["gameplay", "settings", "progress", "presentation"] as const)(
  "disposal during %s notification revokes the remaining observer snapshot",
  async (source) => {
    await using session = createGameSession();
    await using other = createGameSession();
    const runtime = sessionRuntime(session);
    const persistence = createSessionPersistence(session);
    const presentation = createBattlePresentationStore(session);
    const stale = vi.fn();
    let disposal: Promise<void> | undefined;
    const dispose = () => {
      disposal = session.dispose();
    };
    const subscribe = (listener: () => void) => {
      if (source === "presentation") return presentation.subscribe(listener);
      if (source === "gameplay") return subscribeRunSessionCommits(listener, session);
      if (source === "settings") return runtime.settings.subscribe(listener);
      return persistence.subscribeProgress(listener);
    };
    subscribe(dispose);
    subscribe(stale);
    const otherObserver = vi.fn();
    subscribeRunSessionCommits(otherObserver, other);

    if (source === "presentation") presentation.getState().setCardTransferInProgress(true);
    else if (source === "gameplay")
      dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 10)), undefined, session);
    else if (source === "settings") runtime.settings.getState().setMusicVolume(7);
    else runtime.progressCompletion.mark(1);
    expect(disposal).toBeDefined();
    await disposal;
    expect(stale).not.toHaveBeenCalled();
    dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 20)), undefined, other);
    expect(otherObserver).toHaveBeenCalledOnce();
  },
);

it("disposal during restore stops later lifecycle listeners and presentation clearing", async () => {
  const clearBattleUi = vi.fn();
  await using session = createGameSession({ feedback: { clearBattleUi } });
  const runtime = sessionRuntime(session);
  const stale = vi.fn();
  let disposal: Promise<void> | undefined;
  runtime.lifecycle.onRestore(() => {
    disposal = session.dispose();
  });
  runtime.lifecycle.onRestore(stale);

  runtime.progressCompletion.replace();
  expect(disposal).toBeDefined();
  await disposal;
  expect(stale).not.toHaveBeenCalled();
  expect(clearBattleUi).not.toHaveBeenCalled();
});

it("disposal during a save failure stops later status observers while submitted IO drains", async () => {
  using _logged = vi.spyOn(console, "error").mockImplementation(() => {});
  await using session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async () => ({ ok: false, error: "disk full" }),
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  const stale = vi.fn();
  let disposal: Promise<void> | undefined;
  persistence.subscribeFailure(() => {
    disposal = session.dispose();
  });
  persistence.subscribeFailure(stale);

  expect(await persistence.write(persistence.snapshot())).toBe("skipped");
  expect(disposal).toBeDefined();
  await disposal;
  expect(stale).not.toHaveBeenCalled();
});

it("revokes post-commit effects when a publication observer disposes the session", async () => {
  await using session = createGameSession();
  const effect = vi.fn();
  let disposal: Promise<void> | undefined;
  subscribeRunSessionCommits(() => {
    disposal = session.dispose();
  }, session);

  const result = dispatchRunSessionCommand(
    (tx) => {
      setGold(tx, 10);
      return acceptCommand(17);
    },
    { afterCommit: effect },
    session,
  );
  expect(result).toBe(17);
  await disposal;
  expect(effect).not.toHaveBeenCalled();
});
