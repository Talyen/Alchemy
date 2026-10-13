import { beforeEach, describe, expect, it } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  setHasActiveRun,
  setRunProgressActivity,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { mutateRunForTest, resetAllTestStores, setRunProgress } from "../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetAllTestStores();
});

describe("resolveActiveRunForSave", () => {
  it("snapshots the live activity independently of presentation navigation", () => {
    setRunProgress({ gold: 15, initialized: true });
    mutateRunForTest((draft) => {
      setHasActiveRun(draft, true);
      setRunProgressActivity(draft, "destination");
      setScreen(draft, ROUTE_SCREENS.DESTINATION);
    });

    const activeRun = resolveActiveRunForSave(defaultGameSession);
    const save = buildAlchemySaveDataFromStores(defaultGameSession);

    expect(activeRun).not.toBeNull();
    expect(activeRun).not.toHaveProperty("runGold");
    expect(save.gold).toBe(15);
    expect(activeRun?.activity.kind).toBe(ROUTE_SCREENS.DESTINATION);
  });

  it("does not resurrect active run after defeat when a later store write occurs on game-over", () => {
    setRunProgress({ gold: 99, initialized: true });
    mutateRunForTest((draft) => {
      setHasActiveRun(draft, false);
      setScreen(draft, ROUTE_SCREENS.GAME_OVER);
    });

    setRunProgress({ gold: 100 });

    const save = buildAlchemySaveDataFromStores(defaultGameSession);
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

    const save = buildAlchemySaveDataFromStores(defaultGameSession);

    expect(save.materialInventory).toEqual({ wood: 12, iron: 3, herbs: 1, food: 0, gems: 2, stone: 0, hide: 0 });
    expect(save.talentXP).toEqual({ burn: 40 });
    expect(save.unlockedTalents).toEqual({ burn: ["ember-1"] });
  });
});
