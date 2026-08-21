import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { resetAllTestStores } from "../../../helpers/gameplay-store-test";
import { getNavigationStoreView, getRunSessionStoreView, setRunProgress } from "../../../helpers/run-domain-store-test";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    saveAlchemySaveData: vi.fn(),
  };
});

beforeEach(() => {
  resetAllTestStores();
});

describe("resolveActiveRunForSave", () => {
  it("returns null when hasActiveRun is false even if run progress remains populated", () => {
    setRunProgress({ runGold: 42, runPlayerHealth: 10, initialized: true });
    getRunSessionStoreView().setHasActiveRun(false);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.GAME_OVER);

    const activeRun = resolveActiveRunForSave(getRunSessionStoreView().hasActiveRun);
    const save = buildAlchemySaveDataFromStores(activeRun);

    expect(activeRun).toBeNull();
    expect(save.activeRun).toBeNull();
  });

  it("snapshots active run when hasActiveRun is true", () => {
    setRunProgress({ runGold: 15, initialized: true });
    getRunSessionStoreView().setHasActiveRun(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.DESTINATION);

    const activeRun = resolveActiveRunForSave(getRunSessionStoreView().hasActiveRun);
    const save = buildAlchemySaveDataFromStores(activeRun);

    expect(activeRun).not.toBeNull();
    expect(activeRun).not.toHaveProperty("runGold");
    expect(save.gold).toBe(15);
    expect(activeRun?.currentScreen).toBe(ROUTE_SCREENS.DESTINATION);
  });

  it("does not resurrect active run after defeat when a later store write occurs on game-over", () => {
    setRunProgress({ runGold: 99, initialized: true });
    getRunSessionStoreView().setHasActiveRun(false);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.GAME_OVER);

    setRunProgress({ runGold: 100 });

    const save = buildAlchemySaveDataFromStores(resolveActiveRunForSave(getRunSessionStoreView().hasActiveRun));
    expect(save.activeRun).toBeNull();
  });
});

describe("buildAlchemySaveDataFromStores permanent progress", () => {
  it("reads materialInventory and talentXP from the run-domain profile when args are omitted", () => {
    setRunProgress({
      materialInventory: { wood: 12, iron: 3, herbs: 1, food: 0, crystal: 2 },
      talentXP: { burn: 40 },
      unlockedTalents: { burn: ["ember-1"] },
      initialized: true,
    });

    const save = buildAlchemySaveDataFromStores(null);

    expect(save.materialInventory).toEqual({ wood: 12, iron: 3, herbs: 1, food: 0, crystal: 2 });
    expect(save.talentXP).toEqual({ burn: 40 });
    expect(save.unlockedTalents).toEqual({ burn: ["ember-1"] });
  });
});
