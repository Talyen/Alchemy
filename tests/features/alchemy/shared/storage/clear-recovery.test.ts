import { createCleanup } from "@/lib/cleanup";
import { afterEach, expect, it, vi } from "vitest";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { sessionGameplayStore } from "@/features/alchemy/shared/stores/session-gameplay-store";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { deferred } from "../../../../helpers/deferred";
import { createSaveBackend } from "../../../../helpers/save-backend";
import type { SaveBackend } from "@/lib/platform-save-backend";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("retains unsaved gameplay, feedback, and navigation after a failed wipe until retry saves it", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const deletion = deferred<{ ok: false; error: string }>();
  const writes: string[] = [];
  await using session = createGameSession({
    saveBackend: createSaveBackend({ writes, clear: () => deletion.promise }),
  });
  const persistence = createSessionPersistence(session);
  let retry: Promise<unknown> | undefined;
  persistence.trackProgress(() => {
    retry = persistence.checkpoint();
  });
  const display = sessionGameplayStore(session).presentation;
  const showScreen = vi.fn();
  const completed = vi.fn();
  const navigation = createScreenNavigation({ readScreen: () => "menu", showScreen }, session);
  using _scopeCleanup = createCleanup(() => deletion.resolve({ ok: false, error: "denied" }));

  dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 70)), undefined, session);
  const committed = readGameplayState(session);
  persistence.afterProgressSaved(completed);
  navigation.resumeTo("rewards");
  const clearing = clearAllPersistentGameData(session);
  expect(persistence.readProgress().kind).toBe("saving");
  expect(display.getState().runProfile.gold).toBe(0);
  deletion.resolve({ ok: false, error: "denied" });
  expect(await clearing).toBe(false);
  expect(readGameplayState(session)).toBe(committed);
  expect(persistence.readProgress().kind).toBe("failed");
  expect(display.getState().runProfile.gold).toBe(0);
  expect(guardProgressAction(session, () => true, false)()).toBe(false);
  vi.runAllTimers();
  expect(showScreen).not.toHaveBeenCalled();
  expect(completed).not.toHaveBeenCalled();
  persistence.retryProgress();
  await retry;
  vi.runAllTimers();
  expect(JSON.parse(writes.at(-1)!).gold).toBe(70);
  expect(display.getState().runProfile.gold).toBe(70);
  expect(completed).toHaveBeenCalledOnce();
  expect(showScreen).toHaveBeenCalledExactlyOnceWith("rewards");
});

it.each([false, true])("resumes debounced autosave after failed deletion with durable tracking %s", async (durable) => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const deletion = deferred<{ ok: false; error: string }>();
  const writes: string[] = [];
  await using session = createGameSession({
    saveBackend: createSaveBackend({ writes, clear: () => deletion.promise }),
  });
  const persistence = createSessionPersistence(session);
  const autosave = createAlchemyAutosaveLifecycle(() => true, undefined, session, durable);
  using _scopeCleanup = createCleanup(() => {
    deletion.resolve({ ok: false, error: "denied" });
    autosave.dispose(false);
  });

  sessionRuntime(session).settings.getState().setMusicVolume(7);
  const clearing = persistence.clear();
  expect(guardProgressAction(session, () => true, false)()).toBe(false);
  sessionRuntime(session).settings.getState().setBrightness(63);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(writes).toEqual([]);
  deletion.resolve({ ok: false, error: "denied" });
  expect(await clearing).toBe(false);
  await vi.advanceTimersByTimeAsync(10_000);
  await autosave.drain();
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0]!).musicVolume).toBe(7);
  expect(JSON.parse(writes[0]!).brightness).toBe(63);
});

it("retries an interrupted in-flight save without acknowledging it or dropping its completion", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const firstWrite = deferred<{ ok: true }>();
  const retryWrite = deferred<{ ok: true }>();
  const writes: string[] = [];
  await using session = createGameSession({
    saveBackend: createSaveBackend({
      write: (_key, value) => {
        writes.push(value);
        return writes.length === 1 ? firstWrite.promise : retryWrite.promise;
      },
      clear: async () => ({ ok: false, error: "denied" }),
    }),
  });
  const persistence = createSessionPersistence(session);
  const autosave = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
  const completed = vi.fn();
  using _scopeCleanup = createCleanup(() => {
    firstWrite.resolve({ ok: true });
    retryWrite.resolve({ ok: true });
    autosave.dispose(false);
  });

  dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 70)), undefined, session);
  persistence.afterProgressSaved(completed);
  await vi.advanceTimersByTimeAsync(0);
  expect(writes).toHaveLength(1);
  const clearing = persistence.clear();
  firstWrite.resolve({ ok: true });
  expect(await clearing).toBe(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(writes).toHaveLength(2);
  expect(persistence.readProgress().kind).not.toBe("idle");
  expect(completed).not.toHaveBeenCalled();
  retryWrite.resolve({ ok: true });
  await autosave.drain();
  expect(writes.every((value) => JSON.parse(value).gold === 70)).toBe(true);
  expect(persistence.readProgress().kind).toBe("idle");
  expect(completed).toHaveBeenCalledOnce();
});

it("retains a terminal settings save when a failed clear interrupts its exit attempt", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const writing = deferred<{ ok: true }>();
  const writes: string[] = [];
  await using session = createGameSession({
    saveBackend: createSaveBackend({
      write: (_key, value) => {
        writes.push(value);
        return writes.length === 1 ? writing.promise : Promise.resolve({ ok: true });
      },
      clear: async () => ({ ok: false, error: "denied" }),
    }),
  });
  const persistence = createSessionPersistence(session);
  const autosave = createAlchemyAutosaveLifecycle(() => true, undefined, session);
  using _scopeCleanup = createCleanup(() => {
    writing.resolve({ ok: true });
    autosave.dispose(false);
  });

  sessionRuntime(session).settings.getState().setMusicVolume(7);
  autosave.flush(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(writes).toHaveLength(1);
  const clearing = persistence.clear();
  writing.resolve({ ok: true });
  expect(await clearing).toBe(false);
  await vi.advanceTimersByTimeAsync(10_000);
  await autosave.drain();
  expect(writes).toHaveLength(2);
  expect(JSON.parse(writes[1]!).musicVolume).toBe(7);
});

it.each([false, true])("a replacement autosave driver respects a pending clear that succeeds %s", async (ok) => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const deletion = deferred<Awaited<ReturnType<SaveBackend["clear"]>>>();
  const writes: string[] = [];
  await using session = createGameSession({
    saveBackend: createSaveBackend({ writes, clear: () => deletion.promise }),
  });
  const persistence = createSessionPersistence(session);
  const first = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
  let replacement: ReturnType<typeof createAlchemyAutosaveLifecycle> | undefined;
  const completed = vi.fn();
  using _scopeCleanup = createCleanup(() => {
    deletion.resolve(ok ? { ok: true } : { ok: false, error: "clear refused" });
    first.dispose(false);
    replacement?.dispose(false);
  });

  dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 70)), undefined, session);
  persistence.afterProgressSaved(completed);
  const clearing = persistence.clear();
  first.dispose(false);
  replacement = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(writes).toEqual([]);
  deletion.resolve(ok ? { ok: true } : { ok: false, error: "clear refused" });
  expect(await clearing).toBe(ok);
  await vi.advanceTimersByTimeAsync(10_000);
  await replacement.drain();
  expect(writes).toHaveLength(ok ? 0 : 1);
  expect(completed).toHaveBeenCalledTimes(ok ? 0 : 1);
  expect(persistence.readProgress().kind).toBe("idle");
});

it("revokes captured storage observers if a clear notification closes their session", async () => {
  await using session = createGameSession({ saveBackend: createSaveBackend() });
  const persistence = createSessionPersistence(session);
  let disposal: Promise<void> | undefined;
  persistence.subscribeInterruption(() => {
    disposal = session.dispose();
  });
  const staleObserver = vi.fn();
  persistence.subscribeInterruption(staleObserver);

  expect(await persistence.clear()).toBe(true);
  await disposal;
  expect(staleObserver).not.toHaveBeenCalled();
});
