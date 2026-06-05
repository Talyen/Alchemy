// Subscribed run/session fields for screens — use via ScreenRouteContext instead of per-screen stores.
import { useMemo } from "react";
import type { Screen } from "@/lib/routing";
import { getRunPhase } from "@/lib/routing";
import { useRunSessionBattleSlice, useRunSessionRunSlice, useRunSessionTransientSlice } from "./run-session-facade";
import { flattenRunSessionForScreens, type RunScreenData } from "./run-screen-data";

export type { RunScreenData } from "./run-screen-data";

export function useRunScreenData(screen: Screen): RunScreenData {
  const run = useRunSessionRunSlice();
  const session = useRunSessionTransientSlice();
  const battle = useRunSessionBattleSlice();
  return useMemo(
    () =>
      flattenRunSessionForScreens({
        screen,
        phase: getRunPhase(screen, battle.hasActiveBattle),
        run,
        session,
        battle,
      }),
    [screen, run, session, battle],
  );
}
