import { createSaveBackend } from "../../../../helpers/save-backend";
import { describe, expect, it, vi } from "vitest";
import type { SaveBackend } from "@/lib/platform-save-backend";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { SAVE_KEY, SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { SaveStorage } from "@/features/alchemy/shared/storage/save-storage";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { deferred } from "../../../../helpers/deferred";
import {
  futureContentSaveCandidate,
  futureSaveCandidate,
  playableSaveCandidate,
} from "../../../../helpers/save-candidate-fixtures";

function backend() {
  return {
    readCandidates: vi.fn<SaveBackend["readCandidates"]>().mockResolvedValue({ ok: true, candidates: [] }),
    write: vi.fn<SaveBackend["write"]>().mockResolvedValue({ ok: true }),
    writeSync: vi.fn<SaveBackend["writeSync"]>().mockReturnValue(null),
    clear: vi.fn<SaveBackend["clear"]>().mockResolvedValue({ ok: true }),
  };
}

describe("SaveStorage ownership", () => {
  it.each(["save", "saveForExit"] as const)(
    "%s waits for a pending load to identify the protected primary slot",
    async (operation) => {
      const primary = futureSaveCandidate(100);
      const slots = new Map([[SAVE_KEY, primary]]);
      const reading = deferred<void>();
      const releaseRead = deferred<void>();
      const write = vi.fn((key: string, bytes: string) => {
        slots.set(key, bytes);
        return { ok: true as const };
      });
      const storage = new SaveStorage({
        readCandidates: async (key) => {
          const candidates = slots.has(key) ? [slots.get(key)!] : [];
          reading.resolve();
          await releaseRead.promise;
          return { ok: true, candidates };
        },
        write: async (key, bytes) => write(key, bytes),
        writeSync: write,
        clear: async () => ({ ok: true }),
      });
      const loading = storage.load();
      await reading.promise;
      const saving = storage[operation]({ ...createDefaultSaveData(), gold: 17 });
      releaseRead.resolve();
      await loading;
      expect(await saving).toBe("saved");
      expect(slots.get(SAVE_KEY)).toBe(primary);
      expect(JSON.parse(slots.get(SAVE_RECOVERY_KEY)!).gold).toBe(17);
    },
  );

  it("loads the completed preceding write rather than an older snapshot", async () => {
    let bytes = JSON.stringify({ ...createDefaultSaveData(), gold: 1 });
    const writing = deferred<void>();
    const releaseWrite = deferred<void>();
    const storage = new SaveStorage(
      createSaveBackend({
        readCandidates: async (key) => ({ ok: true, candidates: key === SAVE_KEY ? [bytes] : [] }),
        write: async (_key, value) => {
          writing.resolve();
          await releaseWrite.promise;
          bytes = value;
          return { ok: true };
        },
      }),
    );
    const saving = storage.save({ ...createDefaultSaveData(), gold: 2 });
    await writing.promise;
    const loading = storage.load();
    releaseWrite.resolve();
    await saving;
    expect((await loading).data.gold).toBe(2);
  });

  it("finishes an in-flight demo import before clearing so imported progress cannot revive the save", async () => {
    const slots = new Map<string, string>();
    const importing = deferred<void>();
    const releaseImport = deferred<void>();
    const storage = new SaveStorage({
      readCandidates: async (key) => ({ ok: true, candidates: slots.has(key) ? [slots.get(key)!] : [] }),
      readDemoImportSource: async () => {
        importing.resolve();
        await releaseImport.promise;
        return {
          initialized: false,
          fullSaveExists: false,
          readFailed: false,
          candidates: [JSON.stringify({ ...createDefaultSaveData(), gold: 31 })],
        };
      },
      write: async (key, bytes) => {
        slots.set(key, bytes);
        return { ok: true };
      },
      writeSync: () => null,
      clear: async () => {
        slots.clear();
        return { ok: true };
      },
    });
    const loading = storage.load();
    await importing.promise;
    const clearing = storage.clear();
    releaseImport.resolve();
    await Promise.all([loading, clearing]);
    expect(slots.size).toBe(0);
    expect((await storage.load()).data.gold).toBe(0);
  });

  const older = playableSaveCandidate(10);
  const newer = playableSaveCandidate(20);
  const future = futureSaveCandidate(1);
  const futureContent = futureContentSaveCandidate(30);
  it.each<[string, string[], string[], number, string]>([
    ["future primary backup", [newer, future], [], 20, SAVE_RECOVERY_KEY],
    ["future primary content", [futureContent], [newer], 20, SAVE_RECOVERY_KEY],
    ["future recovery backup", [older], [newer, future], 20, SAVE_KEY],
    ["both slots protected", [newer, future], [older, futureContent], 20, SAVE_RECOVERY_KEY],
  ])("selects progress and a safe write slot with %s", async (_label, primary, recovery, savedAt, writeKey) => {
    const storageBackend = backend();
    storageBackend.readCandidates.mockImplementation(async (key) => ({
      ok: true,
      candidates: key === SAVE_KEY ? primary : recovery,
    }));
    const storage = new SaveStorage(storageBackend);

    const loaded = await storage.load();
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.lastSavedAt).toBe(savedAt);
    expect(await storage.save(loaded.data)).toBe("saved");
    expect(storageBackend.write).toHaveBeenCalledExactlyOnceWith(writeKey, expect.any(String));
  });

  it("saves beside a newer-format primary without overwriting it", async () => {
    const protectedBackend = backend();
    const future = JSON.stringify({ ...createDefaultSaveData(), saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 });
    protectedBackend.readCandidates.mockImplementation(async (key) => ({
      ok: true,
      candidates: key === SAVE_KEY ? [future] : [],
    }));
    const openBackend = backend();
    const protectedStorage = new SaveStorage(protectedBackend);
    const openStorage = new SaveStorage(openBackend);
    expect((await protectedStorage.load()).status.kind).toBe("unsupported-newer-schema");
    expect(await protectedStorage.save(createDefaultSaveData())).toBe("saved");
    expect(await openStorage.save(createDefaultSaveData())).toBe("saved");
    expect(protectedBackend.write).toHaveBeenCalledWith(SAVE_RECOVERY_KEY, expect.any(String));
    expect(protectedBackend.write).not.toHaveBeenCalledWith(SAVE_KEY, expect.any(String));
    expect(openBackend.write).toHaveBeenCalledWith(SAVE_KEY, expect.any(String));

    await protectedStorage.clear();
    expect(await protectedStorage.save(createDefaultSaveData())).toBe("saved");
    expect(protectedBackend.write).toHaveBeenCalledWith(SAVE_KEY, expect.any(String));
    expect(openBackend.clear).not.toHaveBeenCalled();
  });

  it("continues from a recovery copy when the main save cannot be read", async () => {
    const storageBackend = backend();
    const recovered = { ...createDefaultSaveData(), discoveredCardIds: ["slash"], lastSavedAt: 50 };
    storageBackend.readCandidates.mockImplementation(async (key) =>
      key === SAVE_KEY
        ? { ok: false, error: new Error("read denied") }
        : { ok: true, candidates: [JSON.stringify(recovered)] },
    );
    const storage = new SaveStorage(storageBackend);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const loaded = await storage.load();
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    expect(await storage.save(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.write).toHaveBeenCalledWith(SAVE_RECOVERY_KEY, expect.any(String));
  });

  it("loads a readable main backup but writes new progress away from the unreadable primary", async () => {
    const storageBackend = backend();
    const backup = { ...createDefaultSaveData(), discoveredCardIds: ["slash"], lastSavedAt: 50 };
    storageBackend.readCandidates.mockImplementation(async (key) =>
      key === SAVE_KEY
        ? { ok: true, candidates: [JSON.stringify(backup)], localReadFailed: true }
        : { ok: true, candidates: [] },
    );
    const storage = new SaveStorage(storageBackend);

    expect((await storage.load()).data.discoveredCardIds).toEqual(["slash"]);
    expect(await storage.save(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.write).toHaveBeenCalledWith(SAVE_RECOVERY_KEY, expect.any(String));
  });

  it("retries a failed main write in the separate recovery slot", async () => {
    const storageBackend = backend();
    storageBackend.write.mockImplementation(async (key) =>
      key === SAVE_KEY ? { ok: false, error: new Error("write denied") } : { ok: true },
    );
    const storage = new SaveStorage(storageBackend);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await storage.save(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.write.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY, SAVE_RECOVERY_KEY]);
    expect(await storage.save(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.write.mock.calls.map(([key]) => key)).toEqual([
      SAVE_KEY,
      SAVE_RECOVERY_KEY,
      SAVE_RECOVERY_KEY,
    ]);
  });

  it.each(["save", "saveForExit"] as const)(
    "%s never falls back over a newer-format recovery save and can retry the primary",
    async (operation) => {
      const protectedRecovery = futureSaveCandidate(100);
      const slots = new Map([
        [SAVE_KEY, playableSaveCandidate(10, { gold: 8 })],
        [SAVE_RECOVERY_KEY, protectedRecovery],
      ]);
      let primaryAvailable = false;
      const write = vi.fn((key: string, bytes: string) => {
        if (key === SAVE_KEY && !primaryAvailable) return { ok: false as const, error: "primary unavailable" };
        slots.set(key, bytes);
        return { ok: true as const };
      });
      const storageBackend = createSaveBackend({
        readCandidates: async (key) => ({ ok: true, candidates: [slots.get(key)!] }),
        write: async (key, bytes) => write(key, bytes),
        writeSync: write,
      });
      const storage = new SaveStorage(storageBackend);
      const loaded = await storage.load();

      expect(await storage[operation]({ ...loaded.data, gold: 9 })).toBe("failed");
      expect(write.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY]);
      expect(slots.get(SAVE_RECOVERY_KEY)).toBe(protectedRecovery);
      primaryAvailable = true;
      expect(await storage[operation]({ ...loaded.data, gold: 9 })).toBe("saved");
      expect((await new SaveStorage(storageBackend).load()).data.gold).toBe(9);
      expect(slots.get(SAVE_RECOVERY_KEY)).toBe(protectedRecovery);
    },
  );

  it.each(["save", "saveForExit"] as const)(
    "%s preserves a protected recovery slot when primary reads fail and recovery is requested again",
    async (operation) => {
      const protectedRecovery = futureContentSaveCandidate(100);
      const storageBackend = backend();
      storageBackend.readCandidates.mockImplementation(async (key) =>
        key === SAVE_KEY ? { ok: false, error: "primary unreadable" } : { ok: true, candidates: [protectedRecovery] },
      );
      const storage = new SaveStorage(storageBackend);
      const loaded = await storage.load();
      storage.routeWritesToRecovery();
      storage.setWritesDisabled(false);

      expect(await storage[operation](loaded.data)).toBe("failed");
      expect(storageBackend.write).not.toHaveBeenCalled();
      expect(storageBackend.writeSync).not.toHaveBeenCalled();
      await storage.clear();
      expect(await storage.save(createDefaultSaveData())).toBe("saved");
      expect(storageBackend.write).toHaveBeenCalledExactlyOnceWith(SAVE_KEY, expect.any(String));
    },
  );

  it("still attempts recovery when neither slot can be read", async () => {
    const storageBackend = backend();
    storageBackend.readCandidates.mockResolvedValue({ ok: false, error: "storage unreadable" });
    const storage = new SaveStorage(storageBackend);
    const loaded = await storage.load();

    expect(loaded.status.kind).toBe("unavailable");
    expect(await storage.save(loaded.data)).toBe("saved");
    expect(storageBackend.write).toHaveBeenCalledExactlyOnceWith(SAVE_RECOVERY_KEY, expect.any(String));
  });

  it.each(["save", "saveForExit"] as const)(
    "keeps newer recovery progress after %s with a repeated or backward clock",
    async (operation) => {
      const slots = new Map<string, string>();
      let failPrimary = false;
      let now = 1000;
      const write = (key: string, bytes: string) => {
        if (failPrimary && key === SAVE_KEY) return { ok: false as const, error: "primary unavailable" };
        slots.set(key, bytes);
        return { ok: true as const };
      };
      const storageBackend: SaveBackend = {
        readCandidates: async (key) => ({ ok: true, candidates: slots.has(key) ? [slots.get(key)!] : [] }),
        write: async (key, bytes) => write(key, bytes),
        writeSync: write,
        clear: async () => ({ ok: true }),
      };
      const storage = new SaveStorage(storageBackend, () => now);
      expect(await storage.save({ ...createDefaultSaveData(), gold: 8 })).toBe("saved");
      failPrimary = true;
      expect(await storage[operation]({ ...createDefaultSaveData(), gold: 9 })).toBe("saved");
      const resumed = new SaveStorage(storageBackend, () => now);
      const loaded = await resumed.load();
      expect(loaded.data.gold).toBe(9);
      now = 900;
      expect(await resumed.save({ ...loaded.data, gold: 10 })).toBe("saved");
      expect((await new SaveStorage(storageBackend).load()).data.gold).toBe(10);
    },
  );

  it("tries the recovery slot when a synchronous exit write throws", async () => {
    const storageBackend = backend();
    storageBackend.writeSync.mockImplementation((key) => {
      if (key === SAVE_KEY) throw new Error("write denied");
      return { ok: true };
    });
    const storage = new SaveStorage(storageBackend);

    expect(await storage.saveForExit(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.writeSync.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY, SAVE_RECOVERY_KEY]);
  });

  it("queues recovery when page exit cannot synchronously write the backup", async () => {
    const storageBackend = backend();
    storageBackend.writeSync.mockImplementation((key) =>
      key === SAVE_KEY ? { ok: false, error: new Error("write denied") } : null,
    );
    const storage = new SaveStorage(storageBackend);
    const snapshot = { ...createDefaultSaveData(), discoveredCardIds: ["slash"] };

    expect(await storage.saveForExit(snapshot)).toBe("saved");
    expect(storageBackend.writeSync.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY, SAVE_RECOVERY_KEY]);
    expect(storageBackend.write.mock.calls.map(([key]) => key)).toEqual([SAVE_RECOVERY_KEY]);
    expect(JSON.parse(storageBackend.write.mock.calls[0]![1]).discoveredCardIds).toEqual(["slash"]);
    expect(await storage.save(snapshot)).toBe("saved");
    expect(storageBackend.write.mock.calls.map(([key]) => key)).toEqual([SAVE_RECOVERY_KEY, SAVE_RECOVERY_KEY]);
  });

  it("keeps the main write route when both synchronous exit writes fail", async () => {
    const storageBackend = backend();
    storageBackend.writeSync.mockImplementation(() => {
      throw new Error("write denied");
    });
    const storage = new SaveStorage(storageBackend);

    expect(await storage.saveForExit(createDefaultSaveData())).toBe("failed");
    expect(storageBackend.writeSync.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY, SAVE_RECOVERY_KEY]);
    expect(storageBackend.write).not.toHaveBeenCalled();
    expect(await storage.save(createDefaultSaveData())).toBe("saved");
    expect(storageBackend.write.mock.calls.map(([key]) => key)).toEqual([SAVE_KEY]);
  });

  it.each(["save", "saveForExit", "clear", "load"] as const)(
    "rejects backend replacement during %s, then permits it after completion",
    async (operation) => {
      const original = backend();
      const replacement = backend();
      const gate = deferred<void>();
      original.write.mockImplementation(async () => {
        await gate.promise;
        return { ok: true };
      });
      original.clear.mockImplementation(async () => {
        await gate.promise;
        return { ok: true };
      });
      original.readCandidates.mockImplementation(async () => {
        await gate.promise;
        return { ok: true, candidates: [] };
      });
      const storage = new SaveStorage(original);
      const pending =
        operation === "save" || operation === "saveForExit"
          ? storage[operation](createDefaultSaveData())
          : storage[operation]();
      // Check before the queue's first microtask as well as during backend I/O.
      expect(() => storage.configureBackend(replacement)).toThrow("operation is pending");
      await Promise.resolve();
      expect(() => storage.configureBackend(replacement)).toThrow("operation is pending");
      gate.resolve();
      await pending;
      storage.configureBackend(replacement);
      expect(await storage.save(createDefaultSaveData())).toBe("saved");
      expect(replacement.write).toHaveBeenCalledOnce();
    },
  );
});
