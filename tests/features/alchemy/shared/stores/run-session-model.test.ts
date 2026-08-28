import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import {
  useRunSessionBattleContext,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-model";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";

beforeEach(() => {
  resetTransientRunUi();
  dispatchRunSessionCommand((draft) => {
    setSyncedBattleState(draft, defaultBattleState());
    setHasActiveBattle(draft, false);
  });
});

describe("run-session-model narrow hooks", () => {
  it("useRunSessionBattleContext reports battle phase when combat is active", () => {
    dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, true));
    const { result } = renderHook(() => useRunSessionBattleContext(ROUTE_SCREENS.BATTLE));
    expect(result.current.phase).toBe("battle");
    expect(result.current.battle.hasActiveBattle).toBe(true);
  });

  it("useRunSessionNavigationSlice reports meta on menu", () => {
    const { result } = renderHook(() => useRunSessionNavigationSlice(ROUTE_SCREENS.MENU));
    expect(result.current.phase).toBe("meta");
    expect(result.current.hasActiveBattle).toBe(false);
  });
});
