import { createSaveBackend } from "../../../../helpers/save-backend";
import { expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { deferred } from "../../../../helpers/deferred";

function fixture() {
  const writes: string[] = [];
  const session = createGameSession({
    saveBackend: createSaveBackend({
      writes,
      writeSync: (_key, value) => {
        writes.push(value);
        return { ok: true };
      },
    }),
  });
  return { session, persistence: createSessionPersistence(session), writes };
}

it.each(["write", "writeOnExit"] as const)(
  "%s cannot revive a snapshot retained before restore or clear",
  async (method) => {
    const { session, persistence, writes } = fixture();
    try {
      persistence.restore({ ...createDefaultSaveData(), gold: 70 });
      const old = persistence.snapshot();
      persistence.restore({ ...createDefaultSaveData(), gold: 80 });
      expect(await persistence.checkpoint()).toBe("saved");
      expect(await persistence[method](old)).toBe("skipped");
      expect(JSON.parse(writes.at(-1)!).gold).toBe(80);
      const beforeClear = persistence.snapshot();
      await persistence.clear();
      const count = writes.length;
      expect(await persistence[method](beforeClear)).toBe("skipped");
      expect(writes).toHaveLength(count);
    } finally {
      await session.dispose();
    }
  },
);

it("orders settings-only snapshots even when their gameplay revisions are equal", async () => {
  const { session, persistence, writes } = fixture();
  try {
    const old = persistence.snapshot();
    sessionRuntime(session).settings.getState().setMusicVolume(7);
    const latest = persistence.snapshot();
    expect(await persistence.write(latest)).toBe("saved");
    expect(await persistence.writeOnExit(old)).toBe("superseded");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!).musicVolume).toBe(7);
  } finally {
    await session.dispose();
  }
});

it("rejects foreign, edited, and fabricated snapshots before storage can replace real progress", async () => {
  const { session, persistence, writes } = fixture();
  const other = fixture();
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const edited = persistence.snapshot();
    edited.gold = 999;
    for (const invalid of [edited, other.persistence.snapshot(), createDefaultSaveData()]) {
      expect(await persistence.write(invalid)).toBe("failed");
    }
    expect(writes).toEqual([]);
    expect(await persistence.checkpoint()).toBe("saved");
  } finally {
    await session.dispose();
    await other.session.dispose();
    vi.restoreAllMocks();
  }
});

it("invalidates queued snapshots at restore before they reach the backend", async () => {
  const { session, persistence } = fixture();
  const barrier = deferred<{ ok: true; candidates: never[] }>();
  const write = vi.fn(async () => ({ ok: true as const }));
  persistence.configure(createSaveBackend({ readCandidates: () => barrier.promise, write }));
  try {
    const loading = persistence.load();
    const stale = persistence.write(persistence.snapshot());
    persistence.restore({ ...createDefaultSaveData(), gold: 80 });
    barrier.resolve({ ok: true, candidates: [] });
    await loading;
    expect(await stale).toBe("skipped");
    expect(write).not.toHaveBeenCalled();
    expect(await persistence.checkpoint()).toBe("saved");
  } finally {
    barrier.resolve({ ok: true, candidates: [] });
    await session.dispose();
  }
});

it("drains an authorized exit snapshot after autosave detaches and the session disposes", async () => {
  const { session, persistence, writes } = fixture();
  const barrier = deferred<{ ok: true; candidates: never[] }>();
  persistence.configure(createSaveBackend({ readCandidates: () => barrier.promise, writes }));
  const lifecycle = createAlchemyAutosaveLifecycle(() => true, undefined, session, true);
  const loading = persistence.load();
  dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 70)), undefined, session);
  lifecycle.dispose();
  const disposal = session.dispose();
  barrier.resolve({ ok: true, candidates: [] });
  await loading;
  await disposal;
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0]!).gold).toBe(70);
});

it("preserves admitted writes on both sides of a load barrier", async () => {
  const { session, persistence } = fixture();
  const barrier = deferred<{ ok: true; candidates: never[] }>();
  const operations: string[] = [];
  let reads = 0;
  persistence.configure(
    createSaveBackend({
      readCandidates: async () => {
        // Primary and recovery reads run together for each load.
        if (++reads <= 2) return barrier.promise;
        operations.push("read");
        return { ok: true, candidates: [] };
      },
      write: async (_key, value) => {
        operations.push(`write:${JSON.parse(value).musicVolume}`);
        return { ok: true };
      },
    }),
  );
  try {
    const firstLoad = persistence.load();
    sessionRuntime(session).settings.getState().setMusicVolume(3);
    const first = persistence.write(persistence.snapshot());
    const secondLoad = persistence.load();
    sessionRuntime(session).settings.getState().setMusicVolume(7);
    const second = persistence.write(persistence.snapshot());
    barrier.resolve({ ok: true, candidates: [] });
    await firstLoad;
    expect(await first).toBe("saved");
    await secondLoad;
    expect(await second).toBe("saved");
    expect(operations).toEqual(["write:3", "read", "read", "write:7"]);
  } finally {
    barrier.resolve({ ok: true, candidates: [] });
    await session.dispose();
  }
});
