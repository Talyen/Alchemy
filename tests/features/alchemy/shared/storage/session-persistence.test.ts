import { describe, expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import * as persistenceModule from "@/features/alchemy/shared/storage/persistence";
import * as runLifecycle from "@/features/alchemy/shared/stores/run-lifecycle";
import * as runReads from "@/features/alchemy/shared/stores/run-reads";

describe("createSessionPersistence", () => {
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
      { abandonIncompatibleBattle: false },
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
