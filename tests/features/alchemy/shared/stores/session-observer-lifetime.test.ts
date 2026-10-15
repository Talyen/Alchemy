import { expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/notification-channel";

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

it.each(["gameplay", "settings", "progress"] as const)(
  "disposal during %s notification revokes the remaining observer snapshot",
  async (source) => {
    const session = createGameSession();
    const other = createGameSession();
    const runtime = sessionRuntime(session);
    const persistence = createSessionPersistence(session);
    const stale = vi.fn();
    let disposal: Promise<void> | undefined;
    const dispose = () => {
      disposal = session.dispose();
    };
    const subscribe = (listener: () => void) => {
      if (source === "gameplay") return subscribeRunSessionCommits(listener, session);
      if (source === "settings") return runtime.settings.subscribe(listener);
      return persistence.subscribeProgress(listener);
    };
    subscribe(dispose);
    subscribe(stale);
    const otherObserver = vi.fn();
    subscribeRunSessionCommits(otherObserver, other);
    try {
      if (source === "gameplay")
        dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 10)), undefined, session);
      else if (source === "settings") runtime.settings.getState().setMusicVolume(7);
      else runtime.progressCompletion.mark(1);
      expect(disposal).toBeDefined();
      await disposal;
      expect(stale).not.toHaveBeenCalled();
      dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 20)), undefined, other);
      expect(otherObserver).toHaveBeenCalledOnce();
    } finally {
      await Promise.all([session.dispose(), other.dispose()]);
    }
  },
);

it("disposal during restore stops later lifecycle listeners and presentation clearing", async () => {
  const clearBattleUi = vi.fn();
  const session = createGameSession({ feedback: { clearBattleUi } });
  const runtime = sessionRuntime(session);
  const stale = vi.fn();
  let disposal: Promise<void> | undefined;
  runtime.lifecycle.onRestore(() => {
    disposal = session.dispose();
  });
  runtime.lifecycle.onRestore(stale);
  try {
    runtime.progressCompletion.replace();
    expect(disposal).toBeDefined();
    await disposal;
    expect(stale).not.toHaveBeenCalled();
    expect(clearBattleUi).not.toHaveBeenCalled();
  } finally {
    await session.dispose();
  }
});

it("disposal during a save failure stops later status observers while submitted IO drains", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const session = createGameSession({
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
  try {
    expect(await persistence.write(persistence.snapshot())).toBe("skipped");
    expect(disposal).toBeDefined();
    await disposal;
    expect(stale).not.toHaveBeenCalled();
  } finally {
    await session.dispose();
    logged.mockRestore();
  }
});
