import { defaultGameSession } from "@/app/application-session";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";
import { readGameplayState, type GameplayState } from "../session/gameplay-state-reads";
import { RUN_SCREEN_SELECTORS, type RunDataScreen, type RunScreenDataByScreen } from "../session/run-screen-data";

export function useRunScreenData<S extends RunDataScreen>(screen: S): RunScreenDataByScreen[S] {
  // The mapped type derives each result from this same key; TypeScript loses
  // that correlation when calling an indexed union of selector functions.
  const select = RUN_SCREEN_SELECTORS[screen] as (state: GameplayState) => RunScreenDataByScreen[S];
  const data = useGameplayStateStore(
    useShallow((state) => {
      // Run end clears activity to inactive, so recaps follow the visible screen.
      const active =
        screen === "game-over" || screen === "run-victory"
          ? state.run.navigation.screen === "game-over" || state.run.navigation.screen === "run-victory"
          : state.session.activity.kind === screen;
      return active ? select(state) : null;
    }),
  );
  const [shown, setShown] = useState(() => data ?? select(readGameplayState(defaultGameSession)));
  // Retain the outgoing route's last active slice while its successor fades in.
  // Inactive routes select null, so later gameplay writes cannot update that slice.
  if (data !== null && shown !== data) setShown(data);
  return data ?? shown;
}
