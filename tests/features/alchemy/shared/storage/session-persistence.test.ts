import { describe, expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import * as storageIo from "@/features/alchemy/shared/storage/io";
import * as persistenceModule from "@/features/alchemy/shared/storage/persistence";
import * as runLifecycle from "@/features/alchemy/shared/stores/run-lifecycle";
import * as runReads from "@/features/alchemy/shared/stores/run-reads";

describe("createSessionPersistence", () => {
  it("delegates clear, recovery, writes-disabled, and reset to storage io for the session", async () => {
    const clearSpy = vi.spyOn(storageIo, "clearAlchemySaveData").mockResolvedValue(true);
    const recoverySpy = vi.spyOn(storageIo, "routeWritesToRecovery").mockImplementation(() => {});
    const disabledSpy = vi.spyOn(storageIo, "setWritesDisabled").mockImplementation(() => {});
    const resetSpy = vi.spyOn(storageIo, "resetStorageIoForTests").mockResolvedValue(undefined);

    const persistence = createSessionPersistence(defaultGameSession);

    await expect(persistence.clear("localWipe")).resolves.toBe(true);
    expect(clearSpy).toHaveBeenCalledWith("localWipe", defaultGameSession);

    await expect(persistence.clear()).resolves.toBe(true);
    expect(clearSpy).toHaveBeenCalledWith("default", defaultGameSession);

    persistence.routeToRecovery();
    expect(recoverySpy).toHaveBeenCalledWith(defaultGameSession);

    persistence.setWritesDisabled(true);
    expect(disabledSpy).toHaveBeenCalledWith(true, defaultGameSession);

    persistence.resetForTests();
    expect(resetSpy).toHaveBeenCalledWith(defaultGameSession);
  });

  it("restores persistence fields and active run when uninitialized", () => {
    const hydrateSpy = vi.spyOn(persistenceModule, "hydrateAlchemyPersistenceFields").mockImplementation(() => {});
    const restoreRunSpy = vi.spyOn(runLifecycle, "restoreRun").mockImplementation(() => {});
    vi.spyOn(runReads, "readRunInitialized").mockReturnValue(false);

    const persistence = createSessionPersistence(defaultGameSession);
    const restored = persistence.restore(defaultSaveData, { preserveActiveRunIfInitialized: true });

    expect(restored).toBe(true);
    expect(hydrateSpy).toHaveBeenCalledWith(defaultSaveData, defaultGameSession);
    expect(restoreRunSpy).toHaveBeenCalledWith(
      defaultSaveData.activeRun,
      defaultSaveData.talentXP,
      defaultSaveData.unlockedTalents,
      defaultGameSession,
    );
  });

  it("preserves active run when preserveActiveRunIfInitialized is true and aggregate is initialized", () => {
    const hydrateSpy = vi.spyOn(persistenceModule, "hydrateAlchemyPersistenceFields").mockImplementation(() => {});
    const restoreRunSpy = vi.spyOn(runLifecycle, "restoreRun").mockImplementation(() => {});
    vi.spyOn(runReads, "readRunInitialized").mockReturnValue(true);

    const persistence = createSessionPersistence(defaultGameSession);
    const restored = persistence.restore(defaultSaveData, { preserveActiveRunIfInitialized: true });

    expect(restored).toBe(false);
    expect(hydrateSpy).toHaveBeenCalledWith(defaultSaveData, defaultGameSession);
    expect(restoreRunSpy).not.toHaveBeenCalled();
  });
});
