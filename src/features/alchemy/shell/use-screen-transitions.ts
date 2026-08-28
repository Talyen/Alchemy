import { useCallback, useRef } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { assertScreenTransitionAllowed, type Screen, type ScreenTransitionOptions } from "@/lib/routing";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setScreen as setScreenMutator } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useLatestRef } from "@/features/alchemy/shared/hooks";

const commandSetScreen = createRunSessionCommand(setScreenMutator);

interface ScreenTransitions {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  commitPendingTransition: () => void;
  cancelPending: () => void;
}

export function useScreenTransitions(
  currentScreen: Screen,
  setScreen: (screen: Screen) => void = commandSetScreen,
): ScreenTransitions {
  const timerRef = useRef(new TimerGroup());
  const pendingTransitionCommitRef = useRef<(() => void) | null>(null);
  const currentScreenRef = useLatestRef(currentScreen);

  const commitPendingTransition = useCallback(() => {
    const commit = pendingTransitionCommitRef.current;
    pendingTransitionCommitRef.current = null;
    commit?.();
  }, []);

  const cancelPending = useCallback(() => {
    timerRef.current.clearAll();
    pendingTransitionCommitRef.current = null;
  }, []);

  const navigateTo = useCallback(
    (nextScreen: Screen, onRenderedScreenCommit?: () => void) => {
      assertScreenTransitionAllowed(currentScreenRef.current, nextScreen);
      cancelPending();
      pendingTransitionCommitRef.current = onRenderedScreenCommit ?? null;
      timerRef.current.setTimeout(() => {
        if (nextScreen === currentScreenRef.current) {
          commitPendingTransition();
          return;
        }
        setScreen(nextScreen);
      }, NAVIGATION_DELAY_MS);
    },
    [cancelPending, commitPendingTransition, currentScreenRef, setScreen],
  );

  const transition = useCallback(
    (nextScreen: Screen, options: ScreenTransitionOptions = {}) => {
      const { delayMs, immediate, onCommit, guard } = options;
      assertScreenTransitionAllowed(currentScreenRef.current, nextScreen);

      const applyImmediate = () => {
        if (guard && !guard()) return;
        setScreen(nextScreen);
        onCommit?.();
      };

      if (immediate) {
        cancelPending();
        applyImmediate();
        return;
      }

      if (delayMs != null) {
        cancelPending();
        timerRef.current.setTimeout(applyImmediate, delayMs);
        return;
      }

      navigateTo(nextScreen, onCommit);
    },
    [cancelPending, currentScreenRef, navigateTo, setScreen],
  );

  return { navigateTo, transition, commitPendingTransition, cancelPending };
}
