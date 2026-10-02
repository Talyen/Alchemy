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
