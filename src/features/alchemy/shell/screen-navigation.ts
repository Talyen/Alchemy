import { TimerGroup } from "@/lib/animation/game-timer";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import {
  assertRunResumeTransitionAllowed,
  assertScreenTransitionAllowed,
  type Screen,
  type ScreenTransitionOptions,
} from "@/lib/routing";

export interface ScreenNavigation {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (screen: Screen, prepareNavigation?: () => void, immediate?: boolean) => void;
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
  // Revision protocol: cancelPending bumps revision and clears timers.
  // transition snapshots it, runs prepare (which may redirect via a nested
  // navigateTo and bump revision), then drops the stale outer request.
  // Gameplay (prepareScreen) commits synchronously; only presentation waits.
  let revision = 0;

  function cancelPending() {
    revision += 1;
    timers.clearAll();
    onPendingChange?.(false);
  }

  function transitionTo(screen: Screen, options: ScreenTransitionOptions, resume: boolean) {
    // Guard first (approved): a skipped move stays a silent no-op even on an
    // unusual edge; only unskipped moves validate against the policy table.
    if (options.guard && !options.guard()) return;
    if (resume) assertRunResumeTransitionAllowed(readScreen(), screen);
    else assertScreenTransitionAllowed(readScreen(), screen);
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

  function transition(screen: Screen, options: ScreenTransitionOptions = {}) {
    transitionTo(screen, options, false);
  }

  return {
    navigateTo: (screen, prepare) => transition(screen, prepare ? { prepare } : {}),
    resumeTo: (screen, prepare, immediate = false) =>
      transitionTo(screen, prepare ? { prepare, immediate } : { immediate }, true),
    transition,
    cancelPending,
  };
}
