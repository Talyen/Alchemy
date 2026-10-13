import { logError } from "@/lib/error-logger";
import type { SessionFeedback } from "./game-session-types";

/** A committed lifecycle change must finish even when one presentation adapter fails. */
export function runSessionEffect(name: string, effect: () => void): void {
  try {
    effect();
  } catch (error) {
    logError("Session effect failed", "other", { effect: name }, undefined, undefined, error);
  }
}

/** Feedback cannot undo a commit or suppress the caller's next required operation. */
export function isolateSessionFeedback(feedback: SessionFeedback): SessionFeedback {
  function protect<Args extends unknown[]>(name: string, effect: (...args: Args) => void) {
    return (...args: Args) => runSessionEffect(name, () => effect(...args));
  }
  return {
    playUISound: protect("UI sound", feedback.playUISound),
    playGoldGain: protect("Gold gain sound", feedback.playGoldGain),
    playGoldSpend: protect("Gold spend sound", feedback.playGoldSpend),
    playVictory: protect("victory sound", feedback.playVictory),
    playRunVictory: protect("run victory sound", feedback.playRunVictory),
    playDefeat: protect("defeat sound", feedback.playDefeat),
    stopAllSfx: protect("stop battle sounds", feedback.stopAllSfx),
    clearCardHover: protect("clear card hover", feedback.clearCardHover),
    clearBattleUi: protect("clear battle UI", feedback.clearBattleUi),
    clearSaveConfirmation: protect("clear save confirmation", feedback.clearSaveConfirmation),
    resetTransientUi: protect("reset transient UI", feedback.resetTransientUi),
  };
}

function createLifecycleChannel(name: string) {
  const listeners = new Set<() => void>();
  return {
    on(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      // Listener additions/removals take effect on the next notification.
      for (const listener of [...listeners]) runSessionEffect(name, listener);
    },
    clear() {
      listeners.clear();
    },
  };
}

/** One session owns the complete presentation invalidation recipe and its listeners. */
export function createRunLifecycleEffects(feedback: Pick<SessionFeedback, "clearBattleUi">) {
  const presentation = createLifecycleChannel("clear battle presentation listener");
  const teardown = createLifecycleChannel("run teardown listener");
  function clearPresentation() {
    feedback.clearBattleUi();
    presentation.emit();
  }
  return {
    onClearPresentation: presentation.on,
    onTeardown: teardown.on,
    clearPresentation,
    teardown() {
      clearPresentation();
      teardown.emit();
    },
    dispose() {
      presentation.clear();
      teardown.clear();
    },
  };
}
