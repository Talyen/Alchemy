import { beforeEach, describe, expect, it } from "vitest";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  hydrateModeRunInDraft,
  parkAndDeactivateForegroundRunInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  readActiveRun,
  readHasActiveRun,
  readParkedRuns,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("park and restore", () => {
  it("parks the live run then restores it by mode", () => {
    setRunProgress({ characterId: "knight", contentSystemType: "campaign", runPlayerHealth: 18 });
    setRunSession({ hasActiveRun: true });
    dispatchRunSessionCommand((draft) => setScreen(draft, "destination"));

    dispatchRunSessionCommand((draft) => {
      parkAndDeactivateForegroundRunInDraft(draft);
    });
    expect(readHasActiveRun()).toBe(false);
    expect(readParkedRuns().campaign?.runPlayerHealth).toBe(18);

    dispatchRunSessionCommand((draft) => {
      expect(hydrateModeRunInDraft(draft, "campaign")).toBe(true);
    });
    expect(readHasActiveRun()).toBe(true);
    expect(readActiveRun().runPlayerHealth).toBe(18);
    expect(readParkedRuns().campaign).toBeUndefined();
  });
});
