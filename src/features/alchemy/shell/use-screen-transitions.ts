import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { showRunScreen, prepareRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { type Screen } from "@/lib/routing";
import { useEffect, useMemo, useState } from "react";
import { createScreenNavigation } from "./screen-navigation";

export function useScreenTransitions(currentScreen: Screen, setScreen: (screen: Screen) => void = showRunScreen) {
  const currentScreenRef = useLatestRef(currentScreen);
  const [navigationPending, setNavigationPending] = useState(false);
  const navigation = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- factory stores the reader; it only runs when a navigation event arrives
      createScreenNavigation({
        readScreen: () => currentScreenRef.current,
        prepareScreen: prepareRunScreen,
        showScreen: setScreen,
        onPendingChange: setNavigationPending,
      }),
    [currentScreenRef, setScreen],
  );
  useEffect(() => navigation.cancelPending, [navigation]);
  return { ...navigation, navigationPending };
}
