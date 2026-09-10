import { useEffect } from "react";
import { readHasActiveRun, readRunPhase } from "@/features/alchemy/shared/stores/run-reads";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import {
  buildAlchemySaveDataFromStores,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  subscribeAlchemyPersistence,
  subscribeSaveCancellation,
  type SaveWriteOutcome,
} from "@/features/alchemy/shared/storage";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS, BATTLE_AUTOSAVE_DEBOUNCE_MS } from "@/lib/game-constants";
import { applyAutosaveCompletion, computeAutosaveDelay, shouldAttemptFlush } from "./autosave-scheduler";

export function useAlchemyAutosaveFromStores(enabled = true) {
  const enabledRef = useLatestRef(enabled);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let revision = 0;
    let acknowledgedRevision = 0;
    let submittedRevision = 0;
    let generation = 0;
    let dirtySince = 0;
    let retryAt = 0;
    let mounted = true;

    const cancelTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const cancelPending = () => {
      cancelTimer();
      generation++;
      revision = 0;
      acknowledgedRevision = 0;
      submittedRevision = 0;
      dirtySince = 0;
      retryAt = 0;
    };

    const schedule = () => {
      cancelTimer();
      if (!mounted || !enabledRef.current || revision <= submittedRevision) return;
      const now = Date.now();
      const debounceMs = isAnimationDisabled()
        ? 0
        : readRunPhase() === "battle"
          ? BATTLE_AUTOSAVE_DEBOUNCE_MS
          : AUTOSAVE_DEBOUNCE_MS;
      const delay = computeAutosaveDelay({ debounceMs, maxWaitMs: AUTOSAVE_MAX_WAIT_MS, now, dirtySince, retryAt });
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
      if (
        !shouldAttemptFlush({
          enabled: true,
          revision,
          acknowledgedRevision,
          submittedRevision,
          terminal,
        })
      )
        return;
      cancelTimer();
      const savingRevision = revision;
      const savingGeneration = generation;
      submittedRevision = savingRevision;
      const activeRun = resolveActiveRunForSave(readHasActiveRun());
      const save = buildAlchemySaveDataFromStores(activeRun);
      const complete = (outcome: SaveWriteOutcome) => {
        if (!mounted || !enabledRef.current || savingGeneration !== generation) return;
        if (outcome === "skipped") {
          cancelPending();
          return;
        }
        const next = applyAutosaveCompletion({
          revision,
          acknowledgedRevision,
          submittedRevision,
          retryAt,
          savingRevision,
          outcome,
          now: Date.now(),
          maxWaitMs: AUTOSAVE_MAX_WAIT_MS,
        });
        acknowledgedRevision = next.acknowledgedRevision;
        submittedRevision = next.submittedRevision;
        retryAt = next.retryAt;
        if (next.cancelTimer) cancelTimer();
        else if (next.schedule && (outcome !== "saved" || timer === null)) schedule();
      };
      const outcome = terminal ? saveAlchemySaveDataForExit(save) : saveAlchemySaveData(save);
      void outcome.then(complete);
    };

    const triggerSave = () => {
      if (!enabledRef.current) return;
      if (revision === submittedRevision) dirtySince = Date.now();
      revision++;
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

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribePersistence();
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush(true);
      mounted = false;
      cancelTimer();
      unsubscribeCancellation();
    };
  }, [enabled, enabledRef]);
}
