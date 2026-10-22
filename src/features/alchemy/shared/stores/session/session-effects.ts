import { createNotificationChannel } from "./notification-channel";
import { logError } from "@/lib/error-logger";
import type { SessionFeedback } from "./game-session-types";

/** A committed lifecycle change must finish even when one presentation adapter fails. */
function runSessionEffect(name: string, effect: () => void): void {
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

function createLifecycleChannel(name: string, isActive: () => boolean) {
  const notifications = createNotificationChannel<[]>((error) => {
    logError("Session effect failed", "other", { effect: name }, undefined, undefined, error);
  }, isActive);
  return { on: notifications.subscribe, emit: notifications.publish, clear: notifications.clear };
}

/** One session owns the complete presentation invalidation recipe and its listeners. */
export function createRunLifecycleEffects(
  feedback: Pick<SessionFeedback, "clearBattleUi">,
  isActive: () => boolean = () => true,
) {
  const presentation = createLifecycleChannel("clear battle presentation listener", isActive);
  const teardown = createLifecycleChannel("run teardown listener", isActive);
  const restore = createLifecycleChannel("run restore listener", isActive);
  function clearPresentation() {
    if (!isActive()) return;
    feedback.clearBattleUi();
    presentation.emit();
  }
  return {
    onClearPresentation: (listener: () => void) => presentation.on(listener),
    onTeardown: (listener: () => void) => teardown.on(listener),
    onRestore: (listener: () => void) => restore.on(listener),
    restore() {
      // Revoke deferred work before clearing its visible state. Cancellation
      // handlers may themselves finish transfers or remove outgoing frames.
      restore.emit();
      clearPresentation();
    },
    clearPresentation,
    teardown() {
      clearPresentation();
      teardown.emit();
    },
    dispose() {
      presentation.clear();
      teardown.clear();
      restore.clear();
    },
  };
}
