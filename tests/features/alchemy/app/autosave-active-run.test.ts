import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/build-save-data-from-stores";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-transitions";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  getNavigationStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    saveAlchemySaveData: vi.fn(),
  };
});

beforeEach(() => {
  resetRunProgressSlice();
  resetTransientRunUi();
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

    expect(activeRun).not.toBeNull();
    expect(activeRun?.runGold).toBe(15);
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
