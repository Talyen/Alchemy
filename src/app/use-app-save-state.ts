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
import type { Screen } from "@/lib/routing";

export function useAlchemyAutosaveFromStores(enabled = true, runScreenOverride: Screen | null = null) {
  const enabledRef = useLatestRef(enabled);
  const runScreenOverrideRef = useLatestRef(runScreenOverride);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
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
      const maxWaitDelay = Math.max(0, AUTOSAVE_MAX_WAIT_MS - (now - dirtySince));
      const delay = Math.max(retryAt - now, Math.min(debounceMs, maxWaitDelay));
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
      if (revision <= acknowledgedRevision || (!terminal && revision <= submittedRevision)) return;
      cancelTimer();
      const savingRevision = revision;
      const savingGeneration = generation;
      submittedRevision = savingRevision;
      const activeRun = resolveActiveRunForSave(readHasActiveRun(), runScreenOverrideRef.current ?? undefined);
      const save = buildAlchemySaveDataFromStores(activeRun);
      const complete = (outcome: SaveWriteOutcome) => {
        if (!mounted || !enabledRef.current || savingGeneration !== generation) return;
        if (outcome === "skipped") {
          cancelPending();
          return;
        }
        if (outcome === "saved") {
          acknowledgedRevision = Math.max(acknowledgedRevision, savingRevision);
          if (savingRevision === submittedRevision) retryAt = 0;
          if (acknowledgedRevision === revision) cancelTimer();
          else if (timer === null) schedule();
        } else if (savingRevision > acknowledgedRevision && savingRevision === submittedRevision) {
          submittedRevision = acknowledgedRevision;
          retryAt = Date.now() + AUTOSAVE_MAX_WAIT_MS;
          schedule();
        }
      };
      const outcome = terminal ? saveAlchemySaveDataForExit(save) : saveAlchemySaveData(save);
      if (typeof outcome === "string") complete(outcome);
      else void outcome.then(complete);
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
  }, [enabled, enabledRef, runScreenOverrideRef]);
}
