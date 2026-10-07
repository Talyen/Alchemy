import { beforeEach, describe, expect, it } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { setHasActiveRun, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { setRunProgress } from "../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

describe("resolveActiveRunForSave", () => {
  it("snapshots active run when hasActiveRun is true", () => {
    setRunProgress({ gold: 15, initialized: true });
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveRun(draft, true);
        setScreen(draft, ROUTE_SCREENS.DESTINATION);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const activeRun = resolveActiveRunForSave(readHasActiveRun(defaultGameSession), undefined, defaultGameSession);
    const save = buildAlchemySaveDataFromStores(activeRun, defaultGameSession);

    expect(activeRun).not.toBeNull();
    expect(activeRun).not.toHaveProperty("runGold");
    expect(save.gold).toBe(15);
    expect(activeRun?.currentScreen).toBe(ROUTE_SCREENS.DESTINATION);
  });

  it("does not resurrect active run after defeat when a later store write occurs on game-over", () => {
    setRunProgress({ gold: 99, initialized: true });
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveRun(draft, false);
        setScreen(draft, ROUTE_SCREENS.GAME_OVER);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    setRunProgress({ gold: 100 });

    const save = buildAlchemySaveDataFromStores(
      resolveActiveRunForSave(readHasActiveRun(defaultGameSession), undefined, defaultGameSession),
      defaultGameSession,
    );
    expect(save.activeRun).toBeNull();
  });
});

describe("buildAlchemySaveDataFromStores permanent progress", () => {
  it("joins materialInventory and talentXP from the session's run profile", () => {
    setRunProgress({
      materialInventory: { wood: 12, iron: 3, herbs: 1, food: 0, gems: 2, stone: 0, hide: 0 },
      talentXP: { burn: 40 },
      unlockedTalents: { burn: ["ember-1"] },
      initialized: true,
    });

    const save = buildAlchemySaveDataFromStores(null, defaultGameSession);

    expect(save.materialInventory).toEqual({ wood: 12, iron: 3, herbs: 1, food: 0, gems: 2, stone: 0, hide: 0 });
    expect(save.talentXP).toEqual({ burn: 40 });
    expect(save.unlockedTalents).toEqual({ burn: ["ember-1"] });
  });
});
