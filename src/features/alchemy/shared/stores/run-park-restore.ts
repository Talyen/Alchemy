import type { ActiveRunData } from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { repairPersistedBattleTrinketManifest } from "@/lib/battle";
import {
  eventHasUnresolvedRandomTrinket,
  pickMysteryEvent,
  repairUnresolvedMysteryTrinkets,
  resolveMysteryEventTrinkets,
} from "@/lib/mystery";
import type { GameplayDraft } from "./run-session-command";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "./run-resume-codec";
import { inferActiveRunScreen } from "./encode-interrupted-flow";
import { getRunSessionFromState } from "./run-session-model";
import { restoreRunSession } from "./restore-active-run-session";
import { createGameplayDraftRunActions, createGameplayDraftSessionActions } from "./gameplay-state-store";
import { initializeActiveBattle } from "./write-port-battle";
import { createDraftRunRandomSource } from "./write-port-run";
import { abandonMysteryDestinationVisit, clearMysteryVisitState, setMysteryEvent } from "./write-port-session";
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
  const session = createGameplayDraftSessionActions(draft);
  session.clearTransientSession();
  session.setHasActiveRun(false);
  initializeActiveBattle(draft, null);
}

export function applyRestoreRunToDraft(draft: GameplayDraft, activeRun: ActiveRunData | null): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  const run = createGameplayDraftRunActions(draft);
  const session = createGameplayDraftSessionActions(draft);
  if (decoded) run.initializeFromResumeSnapshot(decoded.progress);
  else run.initialize(null);

  const battleState =
    activeRun?.activeCombat?.battleState != null
      ? repairPersistedBattleTrinketManifest(activeRun.activeCombat.battleState, activeRun.runTrinkets)
      : null;
  const pending = decoded?.pendingBattleTransition ?? null;
  initializeActiveBattle(draft, battleState, pending);

  const resumeScreen = decoded?.screen ?? (activeRun ? inferActiveRunScreen(activeRun) : null);
  if (resumeScreen) run.setScreen(resumeScreen);
  if (!activeRun) return;

  session.clearTransientSession();
  session.setHasActiveRun(true);
  if (decoded) restoreRunSession(session, decoded.session);
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
      run.setScreen(ROUTE_SCREENS.DESTINATION);
      rebindLiveRunMeta(draft);
      return;
    }
    const rng = createDraftRunRandomSource(draft, "events");
    setMysteryEvent(draft, resolveMysteryEventTrinkets(pickMysteryEvent(rng), draft.run.activeRun.runTrinkets, rng));
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
