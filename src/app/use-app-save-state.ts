import {
  buildAlchemySaveDataFromStores,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeAlchemyPersistence,
  subscribeSaveCancellation,
  type SaveWriteOutcome,
} from "@/features/alchemy/shared/storage";
import { readHasActiveRun, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { logStorageFailure } from "@/lib/storage-logging";
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  AUTOSAVE_RETRY_COOLDOWN_MS,
  BATTLE_AUTOSAVE_DEBOUNCE_MS,
} from "@/lib/game-constants";
import { useEffect } from "react";
import { createAutosaveScheduler } from "./autosave-scheduler";

export function useAlchemyAutosaveFromStores(enabled = true) {
  const enabledRef = useLatestRef(enabled);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduler = createAutosaveScheduler(AUTOSAVE_MAX_WAIT_MS, AUTOSAVE_RETRY_COOLDOWN_MS);
    let mounted = true;

    const cancelTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const cancelPending = () => {
      cancelTimer();
      scheduler.cancel();
    };

    const schedule = () => {
      cancelTimer();
      if (!mounted || !enabledRef.current) return;
      const now = Date.now();
      const debounceMs = isAnimationDisabled()
        ? 0
        : readRunPhase() === "battle"
          ? BATTLE_AUTOSAVE_DEBOUNCE_MS
          : AUTOSAVE_DEBOUNCE_MS;
      const delay = scheduler.nextDelay(now, debounceMs);
      if (delay === null) return;
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, delay);
    };

    const flush = (terminal = false) => {
      if (!enabledRef.current) {
        cancelPending();
        return;
      }
      // Peek before building: exit events and cleanup fire with no new work,
      // and a throwing snapshot must not advance the submitted revision.
      if (!scheduler.canSubmit(terminal)) return;
      // Build before submit: a throwing snapshot must not advance the submitted
      // revision, or the scheduler would stall with no completion to recover it.
      let save;
      try {
        const activeRun = resolveActiveRunForSave(readHasActiveRun());
        save = buildAlchemySaveDataFromStores(activeRun);
      } catch (error) {
        logStorageFailure("Autosave snapshot could not be built", error);
        schedule();
        return;
      }
      const submission = scheduler.submit(terminal);
      if (!submission) return;
      cancelTimer();
      const complete = (outcome: SaveWriteOutcome) => {
        if (!mounted || !enabledRef.current) return;
        const action = scheduler.complete(submission, outcome, Date.now());
        if (action === "cancel") cancelTimer();
        // After a partial save, keep a fresher timer set by newer changes;
        // after a failed write the stored retryAt is stale, so always reschedule.
        else if (action === "schedule" && (outcome !== "saved" || timer === null)) schedule();
      };
      const outcome = terminal ? saveAlchemySaveDataForExit(save) : saveAlchemySaveData(save);
      void outcome.then(complete);
    };

    const triggerSave = () => {
      if (!enabledRef.current) return;
      scheduler.markDirty(Date.now());
      schedule();
    };

    const unsubscribeCancellation = subscribeSaveCancellation(cancelPending);
    const unsubscribePersistence = subscribeAlchemyPersistence(triggerSave);

    const handlePageExit = () => {
      flush(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush(true);
    };

    // Both pagehide and beforeunload flush terminally: pagehide covers modern
    // browsers (including mobile Back-Forward Cache eviction), beforeunload covers
    // older desktop browsers where pagehide alone can miss a reload. The
    // scheduler's exit-once latch makes a double event for the same revision a
    // no-op, so only one exit snapshot is written.
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      try {
        unsubscribePersistence();
        window.removeEventListener("pagehide", handlePageExit);
        window.removeEventListener("beforeunload", handlePageExit);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        // Fire-and-forget terminal flush: complete() early-returns once mounted=false,
        // so this only matters when the write backend can persist synchronously on exit.
        flush(true);
      } finally {
        mounted = false;
        cancelTimer();
        unsubscribeCancellation();
      }
    };
    // Each enabled state owns a subscription lifetime. The latest value prevents
    // the outgoing effect from writing after a render has disabled saving.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enabledRef is a stable latest-ref; freshness without resubscription
  }, [enabled]);
}
