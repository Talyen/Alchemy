import { TimerGroup } from "@/lib/animation/game-timer";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { assertScreenTransitionAllowed, type Screen, type ScreenTransitionOptions } from "@/lib/routing";

export interface ScreenNavigation {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
}

export function createScreenNavigation({
  readScreen,
  prepareScreen,
  showScreen,
  onPendingChange,
}: {
  readScreen: () => Screen;
  prepareScreen: (screen: Screen) => void;
  showScreen: (screen: Screen) => void;
  onPendingChange?: (pending: boolean) => void;
}): ScreenNavigation {
  const timers = new TimerGroup();
  let revision = 0;

  function cancelPending() {
    revision += 1;
    timers.clearAll();
    onPendingChange?.(false);
  }

  function transition(screen: Screen, options: ScreenTransitionOptions = {}) {
    assertScreenTransitionAllowed(readScreen(), screen);
    if (options.guard && !options.guard()) return;
    cancelPending();
    const requestedRevision = revision;
    options.prepare?.();
    if (requestedRevision !== revision) return;
    prepareScreen(screen);
    onPendingChange?.(true);
    const show = () => {
      if (requestedRevision !== revision) return;
      try {
        showScreen(screen);
      } finally {
        if (requestedRevision === revision) onPendingChange?.(false);
      }
    };
    if (options.immediate) show();
    else timers.setTimeout(show, options.delayMs ?? NAVIGATION_DELAY_MS);
  }

  return {
    navigateTo: (screen, prepare) => transition(screen, prepare ? { prepare } : {}),
    transition,
    cancelPending,
  };
}
