// Unified screen transition primitive: delayed setScreen with optional commit
// callback, plus the standard navigateTo used by run-loop flows. Both share
// a single TimerGroup, replacing the separate `navTimer` and
// `rewardTransitionTimer` that used to live in this layer.
// Use `navigateTo` for most run-loop screens (animation + deferred commits).
// Use `transition({ delayMs })` for post-combat victory pacing before rewards.
// Use `transition({ immediate: true })` for game-over / labyrinth abandon.
import { useCallback, useRef } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import type { Screen } from "@/features/alchemy/shared/types";

export interface ScreenTransitionOptions {
  delayMs?: number;
  immediate?: boolean;
  onCommit?: () => void;
  /** When provided, transition is skipped if this returns false (checked at apply time, including after delay). */
  guard?: () => boolean;
}

interface ScreenTransitions {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  commitPendingTransition: () => void;
  cancelPending: () => void;
}

export function useScreenTransitions(currentScreen: Screen, setScreen: (screen: Screen) => void): ScreenTransitions {
  const timerRef = useRef(new TimerGroup());
  const pendingTransitionCommitRef = useRef<(() => void) | null>(null);

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
      timerRef.current.clearAll();
      pendingTransitionCommitRef.current = onRenderedScreenCommit ?? null;
      timerRef.current.setTimeout(() => {
        if (nextScreen === currentScreen) {
          commitPendingTransition();
          return;
        }
        setScreen(nextScreen);
      }, NAVIGATION_DELAY_MS);
    },
    [currentScreen, setScreen, commitPendingTransition],
  );

  const transition = useCallback(
    (nextScreen: Screen, options: ScreenTransitionOptions = {}) => {
      const { delayMs, immediate, onCommit, guard } = options;

      const applyImmediate = () => {
        if (guard && !guard()) return;
        setScreen(nextScreen);
        onCommit?.();
      };

      if (immediate) {
        applyImmediate();
        return;
      }

      if (delayMs != null) {
        timerRef.current.clearAll();
        timerRef.current.setTimeout(applyImmediate, delayMs);
        return;
      }

      navigateTo(nextScreen, onCommit);
    },
    [navigateTo, setScreen],
  );

  return { navigateTo, transition, commitPendingTransition, cancelPending };
}
