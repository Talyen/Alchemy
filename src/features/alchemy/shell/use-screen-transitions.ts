import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { type Screen } from "@/lib/routing";
import { useLayoutEffect, useMemo, useState } from "react";
import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { createScreenNavigation, type ScreenNavigation } from "./screen-navigation";

function createNavigationBinding(options: Parameters<typeof createScreenNavigation>[0], gameSession: GameSession) {
  let mounted: ScreenNavigation | undefined;
  const commands = bindSessionCapabilities(gameSession, {
    navigateTo: (...args: Parameters<ScreenNavigation["navigateTo"]>) => mounted?.navigateTo(...args),
    resumeTo: (...args: Parameters<ScreenNavigation["resumeTo"]>) => mounted?.resumeTo(...args),
    transition: (...args: Parameters<ScreenNavigation["transition"]>) => mounted?.transition(...args),
    cancelPending: () => mounted?.cancelPending(),
  });
  return {
    commands,
    mount() {
      const owner = createScreenNavigation(options, gameSession);
      mounted = owner;
      return () => {
        mounted = undefined;
        owner.dispose();
      };
    },
  };
}

export function useScreenTransitions(
  gameSession: GameSession,
  currentScreen: Screen,
  setScreen?: (screen: Screen) => void,
) {
  const currentScreenRef = useLatestRef(currentScreen);
  const [navigationPending, setNavigationPending] = useState(false);
  const navigation = useMemo(
    () =>
      createNavigationBinding(
        // oxlint-disable-next-line react-hooks/refs -- factory stores the reader; it only runs when a navigation event arrives
        {
          readScreen: () => currentScreenRef.current,
          showScreen: setScreen ?? ((screen) => showRunScreen(screen, gameSession)),
          onPendingChange: setNavigationPending,
        },
        gameSession,
      ),
    [currentScreenRef, setScreen, gameSession],
  );
  // Allocate subscriptions only after commit. Strict Mode may replay this
  // effect; every setup receives a new owner and every cleanup revokes it.
  useLayoutEffect(() => navigation.mount(), [navigation]);
  return useMemo(() => ({ ...navigation.commands, navigationPending }), [navigation, navigationPending]);
}
