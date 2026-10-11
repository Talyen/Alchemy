import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { flushSaveAfterGearMutation, flushSaveAfterRunEnd } from "@/features/alchemy/shared/stores/run-lifecycle";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { subscribePersistenceCommits } from "@/features/alchemy/shared/stores/persistence-commit-filter";
import { readSessionRevision } from "@/features/alchemy/shared/stores/session-capabilities";
import { registerErrorSink } from "@/lib/error-logger";
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

it("acknowledges a snapshot through another adapter for the same session", async () => {
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async () => ({ ok: true }),
      writeSync: () => ({ ok: true }),
      clear: async () => ({ ok: true }),
    },
  });
  const reader = createSessionPersistence(session);
  const writer = createSessionPersistence(session);
  const release = reader.trackProgress(() => {});
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 10)), undefined, session);
    const feedback = vi.fn();
    reader.afterProgressSaved(feedback);
    expect(await writer.write(createDefaultSaveData())).toBe("saved");
    expect(reader.readProgress().kind).toBe("saving");
    expect(feedback).not.toHaveBeenCalled();
    expect(guardProgressAction(session, () => true, false)()).toBe(false);
    expect(await writer.writeOnExit(reader.snapshot())).toBe("saved");
    expect(reader.readProgress().kind).toBe("idle");
    expect(feedback).toHaveBeenCalledOnce();
    expect(guardProgressAction(session, () => true, false)()).toBe(true);
  } finally {
    release();
    await session.dispose();
  }
});

it("immediate Gear and run-end saves share failure, retry and completion with autosave", async () => {
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
  const release = persistence.trackProgress(() => {});
  try {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 30)), undefined, session);
    const feedback = vi.fn();
    persistence.afterProgressSaved(feedback);
    flushSaveAfterGearMutation(session);
    await persistence.waitForWrites();
    expect(persistence.readProgress().kind).toBe("failed");
    expect(feedback).not.toHaveBeenCalled();
    fail = false;
    flushSaveAfterRunEnd(session);
    await persistence.waitForWrites();
    expect(persistence.readProgress().kind).toBe("idle");
    expect(feedback).toHaveBeenCalledOnce();
    expect(JSON.parse(writes.at(-1)!).gold).toBe(30);
  } finally {
    release();
    await session.dispose();
  }
});

it("a failing gameplay observer cannot suppress autosave, later observers, or command feedback", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const writes: string[] = [];
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async (_key, value) => {
        writes.push(value);
        return { ok: true };
      },
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  const release = persistence.trackProgress(() => {});
  const failure = new Error("broken display observer");
  const errors: unknown[] = [];
  const removeSink = registerErrorSink((entry) => errors.push(entry.cause));
  const removeBroken = subscribeRunSessionCommits(() => {
    throw failure;
  }, session);
  let saving: Promise<unknown> | undefined;
  const removeAutosave = subscribePersistenceCommits(() => {
    saving = persistence.checkpoint();
  }, session);
  const observed: number[] = [];
  const removeObserver = subscribeRunSessionCommits((revision) => observed.push(revision), session);
  const feedback = vi.fn();
  try {
    const previousRevision = readSessionRevision(session);
    expect(
      dispatchRunSessionCommand(
        (draft) => {
          setGold(draft, 37);
          return acceptCommand("committed");
        },
        { afterCommit: feedback },
        session,
      ),
    ).toBe("committed");
    await saving;
    expect(observed).toEqual([previousRevision + 1]);
    expect(errors).toEqual([failure]);
    expect(feedback).toHaveBeenCalledExactlyOnceWith("committed");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!).gold).toBe(37);
    expect(persistence.readProgress().kind).toBe("idle");
    // The guard must also be released after observer failure.
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 38)), undefined, session);
    await saving;
    expect(JSON.parse(writes.at(-1)!).gold).toBe(38);
  } finally {
    removeBroken();
    removeAutosave();
    removeObserver();
    removeSink();
    release();
    await session.dispose();
  }
});

it("save-status observers see and checkpoint the newly committed gameplay revision", async () => {
  const writes: string[] = [];
  const session = createGameSession({
    saveBackend: {
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async (_key, value) => {
        writes.push(value);
        return { ok: true };
      },
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    },
  });
  const persistence = createSessionPersistence(session);
  const release = persistence.trackProgress(() => {});
  const observed: Array<{ pending: number; live: number; gold: number }> = [];
  let saving: Promise<unknown> | undefined;
  const unsubscribe = persistence.subscribeProgress(() => {
    const progress = persistence.readProgress();
    if (progress.kind !== "saving") return;
    observed.push({
      pending: progress.revision,
      live: readSessionRevision(session),
      gold: readRunProfile(session).gold,
    });
    saving = persistence.checkpoint();
  });
  try {
    const revision = readSessionRevision(session) + 1;
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, 51)), undefined, session);
    await saving;
    expect(observed).toEqual([{ pending: revision, live: revision, gold: 51 }]);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!).gold).toBe(51);
    expect(persistence.readProgress().kind).toBe("idle");
  } finally {
    unsubscribe();
    release();
    await session.dispose();
  }
});
