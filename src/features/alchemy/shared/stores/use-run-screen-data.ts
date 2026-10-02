import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { readGameplayState, useGameplayStateStore, type GameplayState } from "./gameplay-state-store";
import { RUN_SCREEN_SELECTORS, type RunDataScreen, type RunScreenDataByScreen } from "./run-screen-data";

function useRetainedScreenData<S extends RunDataScreen>(screen: S): RunScreenDataByScreen[S] {
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
  const [shown, setShown] = useState(() => data ?? select(readGameplayState()));
  // Retain the outgoing route's last active slice while its successor fades in.
  // Inactive routes select null, so later gameplay writes cannot update that slice.
  if (data !== null && shown !== data) setShown(data);
  return data ?? shown;
}

export function useShopScreenData() {
  return useRetainedScreenData("shop");
}

export function useAlchemistScreenData() {
  return useRetainedScreenData("alchemist");
}

export function useTrinketShopScreenData() {
  return useRetainedScreenData("trinket-shop");
}

export function useEquipmentShopScreenData() {
  return useRetainedScreenData("equipment-shop");
}

export function useCampfireScreenData() {
  return useRetainedScreenData("campfire");
}

export function useLabyrinthMapScreenData() {
  return useRetainedScreenData("labyrinth-map");
}

export function useRewardsScreenData() {
  return useRetainedScreenData("rewards");
}

export function useDestinationScreenData() {
  return useRetainedScreenData("destination");
}

export function useMysteryScreenData() {
  return useRetainedScreenData("mystery");
}

export function useCorruptionScreenData() {
  return useRetainedScreenData("corruption");
}

export function useRunEndScreenData() {
  return useRetainedScreenData("game-over");
}

export function useWildwoodRemovalScreenData() {
  return useRetainedScreenData("wildwood-removal");
}
