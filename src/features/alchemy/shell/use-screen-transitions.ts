import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { type Screen } from "@/lib/routing";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createScreenNavigation, type ScreenNavigation } from "./screen-navigation";

export function useScreenTransitions(
  gameSession: GameSession,
  currentScreen: Screen,
  setScreen?: (screen: Screen) => void,
) {
  const currentScreenRef = useLatestRef(currentScreen);
  const [navigationPending, setNavigationPending] = useState(false);
  const ownerRef = useRef<ScreenNavigation | null>(null);
  useLayoutEffect(() => {
    const owner = createScreenNavigation(
      {
        readScreen: () => currentScreenRef.current,
        showScreen: setScreen ?? ((screen) => showRunScreen(screen, gameSession)),
        onPendingChange: setNavigationPending,
      },
      gameSession,
    );
    ownerRef.current = owner;
    return () => {
      ownerRef.current = null;
      owner.dispose();
    };
  }, [currentScreenRef, setScreen, gameSession]);
  // Stable delegates stay safe no-ops before mount and after unmount; the
  // owner itself enforces session lifetime on every committed request.
  const commands = useMemo(
    () => ({
      navigateTo: (...args: Parameters<ScreenNavigation["navigateTo"]>) => ownerRef.current?.navigateTo(...args),
      resumeTo: (...args: Parameters<ScreenNavigation["resumeTo"]>) => ownerRef.current?.resumeTo(...args),
      transition: (...args: Parameters<ScreenNavigation["transition"]>) => ownerRef.current?.transition(...args),
      cancelPending: () => ownerRef.current?.cancelPending(),
    }),
    [],
  );
  return useMemo(() => ({ ...commands, navigationPending }), [commands, navigationPending]);
}
