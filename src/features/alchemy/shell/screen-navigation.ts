import {
  afterProgressSaved,
  bindSessionCapabilities,
  registerSessionCleanup,
  sessionClock,
  sessionFeedback,
} from "@/features/alchemy/shared/stores/session/session-capabilities";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { onRunRestored } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { UISound } from "@/lib/audio";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import {
  assertRunResumeTransitionAllowed,
  assertScreenTransitionAllowed,
  ROUTE_SCREENS,
  type Screen,
  type ScreenTransitionOptions,
} from "@/lib/routing";

// Screens whose committed route must wait for the saved activity to be
// restorable after a crash, even when no prepare mutates state on the way.
const SAVE_GATED_SCREENS: ReadonlySet<Screen> = new Set([
  ROUTE_SCREENS.BATTLE,
  ROUTE_SCREENS.REWARDS,
  ROUTE_SCREENS.RUN_VICTORY,
  ROUTE_SCREENS.GAME_OVER,
  ROUTE_SCREENS.DESTINATION,
  ROUTE_SCREENS.LABYRINTH_MAP,
  ROUTE_SCREENS.WILDWOOD_REMOVAL,
]);

export interface ScreenNavigation {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (screen: Screen, prepareNavigation?: () => void, immediate?: boolean) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  dispose: () => void;
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
  // Every external callback can redirect. A request retains its own revision
  // across guards, cancellation notifications, preparation, and save completion.
  let revision = 0;
  let disposed = false;

  function invalidatePending() {
    const invalidation = ++revision;
    timers.clearAll();
    onPendingChange?.(false);
    return invalidation;
  }

  function cancelPending() {
    if (!disposed) invalidatePending();
  }

  function transitionTo(screen: Screen, input: ScreenTransitionOptions, resume: boolean, feedback?: UISound) {
    if (disposed) return;
    const entryRevision = revision;
    const options = bindSessionCapabilities(gameSession, input);
    const isCurrent = (request: number) => !disposed && revision === request;
    // Guard first (approved): a skipped move stays a silent no-op even on an
    // unusual edge; only unskipped moves validate against the policy table.
    if (options.guard && !options.guard()) return;
    if (!isCurrent(entryRevision)) return;
    const previousScreen = readScreen();
    if (!isCurrent(entryRevision)) return;
    if (resume) assertRunResumeTransitionAllowed(previousScreen, screen);
    else assertScreenTransitionAllowed(previousScreen, screen);
    const requestedRevision = invalidatePending();
    if (!isCurrent(requestedRevision)) return;
    options.prepare?.();
    if (!isCurrent(requestedRevision)) return;
    if (feedback && previousScreen !== screen) sessionFeedback(gameSession).playUISound(feedback);
    if (!isCurrent(requestedRevision)) return;
    onPendingChange?.(true);
    if (!isCurrent(requestedRevision)) return;
    const show = () => {
      if (disposed || requestedRevision !== revision) return;
      try {
        showScreen(screen);
      } finally {
        if (requestedRevision === revision) onPendingChange?.(false);
      }
    };
    const present = () => {
      if (disposed || requestedRevision !== revision) return;
      if (options.immediate) show();
      else timers.setTimeout(show, options.delayMs ?? NAVIGATION_DELAY_MS);
    };
    // Domain preparation may change the saved activity; do not present its
    // completed route until that activity can be restored after a crash.
    if (options.prepare || SAVE_GATED_SCREENS.has(screen)) afterProgressSaved(gameSession, present);
    else present();
  }

  function transition(screen: Screen, options: ScreenTransitionOptions = {}) {
    transitionTo(screen, options, false);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      invalidatePending();
    } finally {
      releaseRestore();
      releaseSession();
    }
  }
  const releaseRestore = onRunRestored(cancelPending, gameSession);
  const releaseSession = registerSessionCleanup(gameSession, dispose);
  const commands: Omit<ScreenNavigation, "dispose"> = bindSessionCapabilities(gameSession, {
    navigateTo: (screen, prepare) => transitionTo(screen, prepare ? { prepare } : {}, false, "navigate"),
    resumeTo: (screen, prepare, immediate = false) =>
      transitionTo(screen, prepare ? { prepare, immediate } : { immediate }, true, "resumeRun"),
    transition,
    cancelPending,
  });
  // Cleanup releases ownership even when the session has already closed.
  return Object.freeze({ ...commands, dispose });
}
