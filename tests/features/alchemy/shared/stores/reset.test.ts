import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    clearAlchemySaveData: vi.fn(),
  };
});

import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { ROUTE_SCREENS } from "@/lib/routing";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { addMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDiscoveredCardIds } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { setHasActiveBattle, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetProfileForTest } from "../../../../helpers/gameplay-store-test";
import { resetRunDomainStore, setRunProgress } from "../../../../helpers/run-domain-store-test";

const mockedClearSave = vi.mocked(clearAlchemySaveData);

beforeEach(() => {
  mockedClearSave.mockReset();
  mockedClearSave.mockResolvedValue(true);
  resetProfileForTest();
  useSettingsStore.setState(useSettingsStore.getInitialState());
  resetRunDomainStore();
  resetTransientRunUi();
});

describe("clearAllPersistentGameData", () => {
  it("wipes app, run permanent data, and homestead after a successful disk clear", async () => {
    dispatchRunSessionCommand((draft) => {
      addMaterials(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    expect(readRunProfile().materialInventory).toEqual({
      wood: 0,
      iron: 0,
      herbs: 0,
      food: 0,
      gems: 0,
    });
    expect(readRunProfile().unlockedTalents).toEqual({});
    expect(readProfileStore().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(readProfileStore().discoveredCardIds).not.toContain("card-a");
  });

  it("tears down the live run, session, and battle alongside the wipe", async () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(readActiveRun().roomsEncountered).toBe(0);
    expect(readActiveRunScreen()).toBe(ROUTE_SCREENS.MENU);
  });

  it("leaves memory intact when the disk wipe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedClearSave.mockResolvedValue(false);
    dispatchRunSessionCommand((draft) => {
      addMaterials(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });

    await expect(clearAllPersistentGameData()).resolves.toBe(false);

    expect(readRunProfile().materialInventory.wood).toBe(10);
    expect(readRunProfile().unlockedTalents).toEqual({ physical: ["test-talent"] });
    expect(readProfileStore().discoveredCardIds).toContain("card-a");
  });
});
