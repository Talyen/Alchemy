import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { deferred } from "../../../../helpers/deferred";
import type { SaveBackend } from "@/lib/platform-save-backend";

afterEach(() => vi.restoreAllMocks());

it("keeps a failed action pending and retries its snapshot without repeating its cost", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  const writes: string[] = [];
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async (_key, value) => {
        writes.push(value);
        return fail ? { ok: false, error: "disk full" } : { ok: true };
      },
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  let retry: Promise<unknown> = Promise.resolve();
  const release = persistence.trackProgress(() => {
    retry = persistence.checkpoint();
  });
  const completion = vi.fn();
  const spend = guardProgressAction(
    session,
    () => {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setGold(draft, readRunProfile(session).gold - 10)),
        undefined,
        session,
      );
      return true;
    },
    false,
  );
  dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 100)), undefined, session);
  expect(await persistence.checkpoint()).toBe("failed");
  fail = false;
  await persistence.checkpoint();
  fail = true;
  expect(spend()).toBe(true);
  persistence.afterProgressSaved(completion);
  expect(spend()).toBe(false);
  expect(await persistence.checkpoint()).toBe("failed");
  expect(persistence.readProgress().kind).toBe("failed");
  expect(completion).not.toHaveBeenCalled();
  fail = false;
  persistence.retryProgress();
  persistence.retryProgress();
  await retry;
  expect(readRunProfile(session).gold).toBe(90);
  expect(JSON.parse(writes.at(-1)!).gold).toBe(90);
  expect(completion).toHaveBeenCalledOnce();
  expect(persistence.readProgress().kind).toBe("idle");
  release();
  await session.dispose();
});

it("an old acknowledgement cannot unlock newer progress and a clear invalidates late receipts", async () => {
  const pending: Array<ReturnType<typeof deferred<Awaited<ReturnType<SaveBackend["write"]>>>>> = [];
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: () => {
        const result = deferred<Awaited<ReturnType<SaveBackend["write"]>>>();
        pending.push(result);
        return result.promise;
      },
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  const release = persistence.trackProgress(() => {});
  const set = (gold: number) =>
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, gold)), undefined, session);
  set(10);
  const old = persistence.checkpoint();
  await Promise.resolve();
  set(20);
  const newer = persistence.checkpoint();
  pending[0]!.resolve({ ok: true });
  await old;
  expect(persistence.readProgress().kind).toBe("saving");
  const completed = vi.fn();
  persistence.afterProgressSaved(completed);
  const clear = persistence.clear();
  pending[1]!.resolve({ ok: true });
  expect(await newer).toBe("skipped");
  expect(await clear).toBe(true);
  expect(completed).not.toHaveBeenCalled();
  expect(persistence.readProgress().kind).toBe("idle");
  release();
  await session.dispose();
});

it.each(["restore", "protection", "dispose"] as const)(
  "%s cannot release a cancelled action's completion from a late save",
  async (cancel) => {
    const writing = deferred<{ ok: true }>();
    const session = createGameSession({
      saveBackend: {
        readCandidates: async () => ({ ok: true, candidates: [] }),
        write: () => writing.promise,
        writeSync: () => null,
        clear: async () => ({ ok: true }),
      },
    });
    const persistence = createSessionPersistence(session);
    const release = persistence.trackProgress(() => {});
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 10)), undefined, session);
    const checkpoint = persistence.checkpoint();
    const feedback = vi.fn();
    persistence.afterProgressSaved(feedback);
    await Promise.resolve();
    let disposal: Promise<void> | undefined;
    if (cancel === "restore") persistence.restore(createDefaultSaveData());
    if (cancel === "protection") persistence.setWritesDisabled(true);
    if (cancel === "dispose") disposal = session.dispose();
    writing.resolve({ ok: true });
    expect(await checkpoint).toBe("skipped");
    expect(feedback).not.toHaveBeenCalled();
    if (cancel === "restore") expect(await persistence.checkpoint()).toBe("saved");
    if (disposal) await disposal;
    else {
      release();
      await session.dispose();
    }
  },
);

it("an explicit checkpoint defers completion even without an autosave owner", async () => {
  const writing = deferred<{ ok: true }>();
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: () => writing.promise,
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  const checkpoint = persistence.checkpoint();
  const feedback = vi.fn();
  persistence.afterProgressSaved(feedback);
  expect(feedback).not.toHaveBeenCalled();
  writing.resolve({ ok: true });
  expect(await checkpoint).toBe("saved");
  expect(feedback).toHaveBeenCalledOnce();
  await session.dispose();
});
