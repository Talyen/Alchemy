// Unified screen transition helper for navigateTo vs immediate setScreen paths.
// Use navigateTo (use-screen-navigation) for most run-loop screens with animation + deferred commits.
// Use transitionScreen({ delayMs }) for post-combat victory pacing before rewards.
// Use transitionScreen({ immediate: true }) for game-over after teardown when hasActiveRun is already false.
import type { RefObject } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { Screen } from "@/features/alchemy/shared/types";

export type ScreenTransitionDeps = {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
};

export type ScreenTransitionOptions = {
  delayMs?: number;
  immediate?: boolean;
  onCommit?: () => void;
  /** When provided, transition is skipped if this returns false (checked at apply time, including after delay). */
  guard?: () => boolean;
};

export function createScreenTransition(deps: ScreenTransitionDeps, timerRef?: RefObject<TimerGroup>) {
  return function transitionScreen(screen: Screen, options: ScreenTransitionOptions = {}) {
    const { delayMs, immediate, onCommit, guard } = options;

    const applyImmediate = () => {
      if (guard && !guard()) return;
      deps.setScreen(screen);
      onCommit?.();
    };

    const applyNavigate = () => {
      deps.navigateTo(screen, onCommit);
    };

    if (immediate) {
      applyImmediate();
      return;
    }

    if (delayMs != null && timerRef) {
      timerRef.current.clearAll();
      timerRef.current.setTimeout(applyImmediate, delayMs);
      return;
    }

    applyNavigate();
  };
}
