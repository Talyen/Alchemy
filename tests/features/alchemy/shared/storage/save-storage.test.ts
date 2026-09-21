import { describe, expect, it, vi } from "vitest";
import type { SaveBackend } from "@/lib/platform-save-backend";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { SaveStorage } from "@/features/alchemy/shared/storage/save-storage";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { deferred } from "../../../../helpers/deferred";

function backend() {
  return {
    readCandidates: vi.fn<SaveBackend["readCandidates"]>().mockResolvedValue({ ok: true, candidates: [] }),
    write: vi.fn<SaveBackend["write"]>().mockResolvedValue({ ok: true }),
    writeSync: vi.fn<SaveBackend["writeSync"]>().mockReturnValue(null),
    clear: vi.fn<SaveBackend["clear"]>().mockResolvedValue({ ok: true }),
  };
}

describe("SaveStorage ownership", () => {
  it("isolates future-save protection, cancellation, and transport between instances", async () => {
    const protectedBackend = backend();
    protectedBackend.readCandidates.mockResolvedValue({
      ok: true,
      candidates: [JSON.stringify({ ...createDefaultSaveData(), saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 })],
    });
    const openBackend = backend();
    const protectedStorage = new SaveStorage(protectedBackend);
    const openStorage = new SaveStorage(openBackend);
    const protectedCancelled = vi.fn();
    const openCancelled = vi.fn();
    protectedStorage.subscribeCancellation(protectedCancelled);
    openStorage.subscribeCancellation(openCancelled);

    expect((await protectedStorage.load()).status.kind).toBe("unsupported-newer-schema");
    expect(await protectedStorage.save(createDefaultSaveData())).toBe("skipped");
    expect(await openStorage.save(createDefaultSaveData())).toBe("saved");
    expect(protectedBackend.write).not.toHaveBeenCalled();
    expect(openBackend.write).toHaveBeenCalledOnce();
    expect(protectedCancelled).toHaveBeenCalledOnce();
    expect(openCancelled).not.toHaveBeenCalled();

    await protectedStorage.clear();
    expect(await protectedStorage.save(createDefaultSaveData())).toBe("saved");
    expect(openBackend.clear).not.toHaveBeenCalled();
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
