import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  prepareRunNavigation,
  setScreen as setScreenMutator,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { type Screen } from "@/lib/routing";
import { useEffect, useMemo } from "react";
import { createScreenNavigation } from "./screen-navigation";

const commandSetScreen = createRunSessionCommand(setScreenMutator);
const commandPrepareScreen = createRunSessionCommand(prepareRunNavigation);

export function useScreenTransitions(currentScreen: Screen, setScreen: (screen: Screen) => void = commandSetScreen) {
  const currentScreenRef = useLatestRef(currentScreen);
  const navigation = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- factory stores the reader; it only runs when a navigation event arrives
      createScreenNavigation({
        readScreen: () => currentScreenRef.current,
        prepareScreen: commandPrepareScreen,
        showScreen: setScreen,
      }),
    [currentScreenRef, setScreen],
  );
  useEffect(() => navigation.cancelPending, [navigation]);
  return navigation;
}
