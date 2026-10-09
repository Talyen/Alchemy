import { afterProgressSaved, bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  registerSessionCleanup,
  sessionClock,
  sessionFeedback,
} from "@/features/alchemy/shared/stores/session-capabilities";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { UISound } from "@/lib/audio";
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

export function createScreenNavigation(
  {
    readScreen,
    showScreen,
    onPendingChange,
  }: {
    readScreen: () => Screen;
    showScreen: (screen: Screen) => void;
    onPendingChange?: (pending: boolean) => void;
  },
  gameSession: GameSession,
): ScreenNavigation {
  const timers = new TimerGroup(sessionClock(gameSession));
  // Revision protocol: cancelPending bumps revision and clears timers.
  // transition snapshots it, runs prepare (which may redirect via a nested
  // navigateTo and bump revision), then drops the stale outer request.
  // Explicit domain preparation commits synchronously; only presentation waits.
  let revision = 0;

  function cancelPending() {
    revision += 1;
    timers.clearAll();
    onPendingChange?.(false);
  }

  function transitionTo(screen: Screen, options: ScreenTransitionOptions, resume: boolean, feedback?: UISound) {
    // Guard first (approved): a skipped move stays a silent no-op even on an
    // unusual edge; only unskipped moves validate against the policy table.
    if (options.guard && !options.guard()) return;
    const previousScreen = readScreen();
    if (resume) assertRunResumeTransitionAllowed(previousScreen, screen);
    else assertScreenTransitionAllowed(previousScreen, screen);
    cancelPending();
    const requestedRevision = revision;
    options.prepare?.();
    if (requestedRevision !== revision) return;
    if (feedback && previousScreen !== screen) sessionFeedback(gameSession).playUISound(feedback);
    onPendingChange?.(true);
    const show = () => {
      if (requestedRevision !== revision) return;
      try {
        showScreen(screen);
      } finally {
        if (requestedRevision === revision) onPendingChange?.(false);
      }
    };
    const present = () => {
      if (requestedRevision !== revision) return;
      if (options.immediate) show();
      else timers.setTimeout(show, options.delayMs ?? NAVIGATION_DELAY_MS);
    };
    // Domain preparation may change the saved activity; do not present its
    // completed route until that activity can be restored after a crash.
    if (
      options.prepare ||
      ["battle", "rewards", "run-victory", "game-over", "destination", "labyrinth-map", "wildwood-removal"].includes(
        screen,
      )
    )
      afterProgressSaved(gameSession, present);
    else present();
  }

  function transition(screen: Screen, options: ScreenTransitionOptions = {}) {
    transitionTo(screen, options, false);
  }

  registerSessionCleanup(gameSession, cancelPending);
  return bindSessionCapabilities(gameSession, {
    navigateTo: (screen, prepare) => transitionTo(screen, prepare ? { prepare } : {}, false, "navigate"),
    resumeTo: (screen, prepare, immediate = false) =>
      transitionTo(screen, prepare ? { prepare, immediate } : { immediate }, true, "resumeRun"),
    transition,
    cancelPending,
  });
}
