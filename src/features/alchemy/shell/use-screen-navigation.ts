// Delayed screen transitions with deferred store commits for transition pacing.
import { useCallback, useRef } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import type { Screen } from "@/features/alchemy/types";

export function useScreenNavigation(screen: Screen, setScreen: React.Dispatch<React.SetStateAction<Screen>>) {
  const navTimer = useRef(new TimerGroup());
  const pendingTransitionCommitRef = useRef<(() => void) | null>(null);

  const commitPendingTransition = useCallback(() => {
    const commit = pendingTransitionCommitRef.current;
    pendingTransitionCommitRef.current = null;
    commit?.();
  }, []);

  const navigateTo = useCallback(
    (nextScreen: Screen, onRenderedScreenCommit?: () => void) => {
      navTimer.current.clearAll();
      pendingTransitionCommitRef.current = onRenderedScreenCommit ?? null;
      navTimer.current.setTimeout(() => {
        if (nextScreen === screen) {
          commitPendingTransition();
          return;
        }
        setScreen(nextScreen);
      }, NAVIGATION_DELAY_MS);
    },
    [screen, setScreen, commitPendingTransition],
  );

  return { navigateTo, commitPendingTransition };
}
