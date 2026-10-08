import { defaultGameSession } from "@/app/application-session";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { type Screen } from "@/lib/routing";
import { useEffect, useMemo, useState } from "react";
import { createScreenNavigation } from "./screen-navigation";

const showApplicationScreen = (screen: Screen) => showRunScreen(screen, defaultGameSession);

export function useScreenTransitions(
  currentScreen: Screen,
  setScreen: (screen: Screen) => void = showApplicationScreen,
) {
  const currentScreenRef = useLatestRef(currentScreen);
  const [navigationPending, setNavigationPending] = useState(false);
  const navigation = useMemo(
    () =>
      createScreenNavigation(
        // oxlint-disable-next-line react-hooks/refs -- factory stores the reader; it only runs when a navigation event arrives
        {
          readScreen: () => currentScreenRef.current,
          showScreen: setScreen,
          onPendingChange: setNavigationPending,
        },
        defaultGameSession,
      ),
    [currentScreenRef, setScreen],
  );
  useEffect(() => navigation.cancelPending, [navigation]);
  return useMemo(() => ({ ...navigation, navigationPending }), [navigation, navigationPending]);
}
