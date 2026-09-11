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
}: {
  readScreen: () => Screen;
  prepareScreen: (screen: Screen) => void;
  showScreen: (screen: Screen) => void;
}): ScreenNavigation {
  const timers = new TimerGroup();
  let revision = 0;

  function cancelPending() {
    revision += 1;
    timers.clearAll();
  }

  function transition(screen: Screen, options: ScreenTransitionOptions = {}) {
    assertScreenTransitionAllowed(readScreen(), screen);
    if (options.guard && !options.guard()) return;
    cancelPending();
    const requestedRevision = revision;
    options.prepare?.();
    if (requestedRevision !== revision) return;
    prepareScreen(screen);
    const show = () => {
      if (requestedRevision === revision) showScreen(screen);
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
