import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  hydrateModeRunInDraft,
  parkAndDeactivateForegroundRunInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import {
  getNavigationStoreView,
  getRunDomainStore,
  getRunTransientStore,
} from "../../../../helpers/gameplay-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("park and restore", () => {
  it("parks the live run then restores it by mode", () => {
    setRunProgress({ characterId: "knight", contentSystemType: "campaign", runPlayerHealth: 18 });
    setRunSession({ hasActiveRun: true });
    getNavigationStoreView().setScreen("destination");

    dispatchRunSessionCommand((draft) => {
      parkAndDeactivateForegroundRunInDraft(draft);
    });
    expect(getRunTransientStore().hasActiveRun).toBe(false);
    expect(getRunDomainStore().parkedRuns.campaign?.runPlayerHealth).toBe(18);

    dispatchRunSessionCommand((draft) => {
      expect(hydrateModeRunInDraft(draft, "campaign")).toBe(true);
    });
    expect(getRunTransientStore().hasActiveRun).toBe(true);
    expect(getRunDomainStore().activeRun.runPlayerHealth).toBe(18);
    expect(getRunDomainStore().parkedRuns.campaign).toBeUndefined();
  });
});
