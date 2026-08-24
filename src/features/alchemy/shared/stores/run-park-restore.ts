import type { ActiveRunData } from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { repairPersistedBattleTrinketManifest } from "@/lib/battle";
import {
  eventHasUnresolvedRandomTrinket,
  pickResolvedMysteryEvent,
  repairUnresolvedMysteryTrinkets,
} from "@/lib/mystery";
import type { GameplayDraft } from "./run-session-command";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "./run-resume-codec";
import { inferActiveRunScreen } from "./encode-interrupted-flow";
import { getRunSessionFromState } from "./run-session-model";
import { restoreRunSession } from "./restore-active-run-session";
import {
  abandonMysteryDestinationVisit,
  clearMysteryVisitState,
  clearTransientSession,
  setHasActiveRun,
  setMysteryEvent,
} from "./write-port-session";
import {
  createDraftRunRandomSource,
  initializeActiveRun,
  initializeFromResumeSnapshot,
  setScreen,
} from "./write-port-run";
import { initializeActiveBattle } from "./write-port-battle";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { omitParkedMode, removeRunRecency, touchRunRecency } from "./parked-runs";

function encodeParkedSnapshot(draft: GameplayDraft): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSessionFromState(draft, draft.run.navigation.screen));
}

export function parkForegroundRunInDraft(draft: GameplayDraft): void {
  if (!draft.session.hasActiveRun) return;
  const mode = draft.run.activeRun.contentSystemType;
  draft.run.parkedRuns[mode] = encodeParkedSnapshot(draft);
  draft.run.runRecency = touchRunRecency(draft.run.runRecency, mode);
}

/** Snapshot the live run into its mode slot and drop it from the hydrated tree without clearing the slot. */
export function parkAndDeactivateForegroundRunInDraft(draft: GameplayDraft): void {
  if (!draft.session.hasActiveRun) return;
  parkForegroundRunInDraft(draft);
  clearTransientSession(draft);
  setHasActiveRun(draft, false);
  initializeActiveBattle(draft, null);
}

export function applyRestoreRunToDraft(draft: GameplayDraft, activeRun: ActiveRunData | null): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  if (decoded) initializeFromResumeSnapshot(draft, decoded.progress);
  else initializeActiveRun(draft, null);

  const battleState =
    activeRun?.activeCombat?.battleState != null
      ? repairPersistedBattleTrinketManifest(activeRun.activeCombat.battleState, activeRun.runTrinkets)
      : null;
  const pending = decoded?.pendingBattleTransition ?? null;
  initializeActiveBattle(draft, battleState, pending);

  const resumeScreen = decoded?.screen ?? (activeRun ? inferActiveRunScreen(activeRun) : null);
  if (resumeScreen) setScreen(draft, resumeScreen);
  if (!activeRun) return;

  clearTransientSession(draft);
  setHasActiveRun(draft, true);
  if (decoded) restoreRunSession(draft, decoded.session);
  if (draft.session.mysteryEvent && eventHasUnresolvedRandomTrinket(draft.session.mysteryEvent)) {
    const rng = createDraftRunRandomSource(draft, "events");
    setMysteryEvent(
      draft,
      repairUnresolvedMysteryTrinkets(draft.session.mysteryEvent, draft.run.activeRun.runTrinkets, rng),
    );
  }
  if (resumeScreen === "mystery" && !draft.session.mysteryEvent) {
    if (activeRun.mysteryVisit != null) {
      abandonMysteryDestinationVisit(draft);
      clearMysteryVisitState(draft);
      setScreen(draft, ROUTE_SCREENS.DESTINATION);
      rebindLiveRunMeta(draft);
      return;
    }
    const rng = createDraftRunRandomSource(draft, "events");
    setMysteryEvent(draft, pickResolvedMysteryEvent(rng, draft.run.activeRun.runTrinkets));
  }
  rebindLiveRunMeta(draft);
}

export function hydrateModeRunInDraft(draft: GameplayDraft, mode: ContentSystemId): boolean {
  const parked = draft.run.parkedRuns[mode];
  if (!parked) return false;
  if (draft.session.hasActiveRun && draft.run.activeRun.contentSystemType !== mode) {
    parkForegroundRunInDraft(draft);
  }
  draft.run.parkedRuns = omitParkedMode(draft.run.parkedRuns, mode);
  applyRestoreRunToDraft(draft, parked);
  draft.run.runRecency = touchRunRecency(draft.run.runRecency, mode);
  return true;
}

export function clearModeSlotInDraft(draft: GameplayDraft, mode: ContentSystemId): void {
  draft.run.parkedRuns = omitParkedMode(draft.run.parkedRuns, mode);
  draft.run.runRecency = removeRunRecency(draft.run.runRecency, mode);
}
