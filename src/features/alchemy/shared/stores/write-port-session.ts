import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import { createGameplayDraftRunActions, createGameplayDraftSessionActions } from "./gameplay-state-store";

const runActions = (state: GameplayDraft) => createGameplayDraftRunActions(state);
const sessionActions = (state: GameplayDraft) => createGameplayDraftSessionActions(state);

export const setPendingCharacterId = bindDraftAction((s) => sessionActions(s).setPendingCharacterId);
export const setPendingContentSystemType = bindDraftAction((s) => sessionActions(s).setPendingContentSystemType);
export const setWildwoodDraft = bindDraftAction((s) => sessionActions(s).setWildwoodDraft);
export const setStarterDraftChoices = bindDraftAction((s) => sessionActions(s).setStarterDraftChoices);

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  run.hydrateFromSnapshot(snapshot);
  session.setRunEndTalentXP({});
  session.setHasActiveRun(snapshot.hasActiveRun);
}

export const setRewardState = bindDraftAction((s) => sessionActions(s).setRewardState);
export const setCompanionRewardCards = bindDraftAction((s) => sessionActions(s).setCompanionRewardCards);
export const beginRewardClaim = bindDraftAction((s) => sessionActions(s).beginRewardClaim);
export const releaseRewardClaim = bindDraftAction((s) => sessionActions(s).releaseRewardClaim);
export const beginDestinationClaim = bindDraftAction((s) => sessionActions(s).beginDestinationClaim);
export const cancelDestinationClaim = bindDraftAction((s) => sessionActions(s).cancelDestinationClaim);
export const setRunEndMaterials = bindDraftAction((s) => sessionActions(s).setRunEndMaterials);
export const setCorruptionResult = bindDraftAction((s) => sessionActions(s).setCorruptionResult);

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const transient = draft.session;
  if (transient.pendingDestinationClaim !== destination) return false;
  if (!transient.rewardState.destinations.includes(destination)) {
    session.cancelDestinationClaim();
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    run.setDestinationOfferState({
      lastOfferedDestinations: [...transient.rewardState.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  session.setRewardState((prev) => ({ ...prev, destinations: [] }));
  session.cancelDestinationClaim();
  run.setCompletedDestinations((prev) => [...prev, destination]);
  run.setDestinationIndexInAct((prev) => prev + 1);
  return true;
}

/** Undo a destination visit that never resolved so the same picker returns. */
function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const transient = draft.session;

  if (transient.pendingDestinationClaim === destination) {
    session.cancelDestinationClaim();
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    run.setCompletedDestinations((prev) => prev.slice(0, -1));
    run.setDestinationIndexInAct((prev) => Math.max(0, prev - 1));
  }

  if (transient.rewardState.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      session.setRewardState((prev) => ({ ...prev, destinations: restored }));
    }
  }

  if (destination === DESTINATIONS.CORRUPTION) {
    session.setCorruptionResult(null);
  }
}

/** Undo a Corruption visit that never mutated a card so the same destination picker returns. */
export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

/** Undo a Mystery visit whose event could not be restored. */
export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

export const setShopState = bindDraftAction((s) => sessionActions(s).setShopState);
export const setAlchemistState = bindDraftAction((s) => sessionActions(s).setAlchemistState);
export const setTrinketShopState = bindDraftAction((s) => sessionActions(s).setTrinketShopState);
export const setEquipmentShopState = bindDraftAction((s) => sessionActions(s).setEquipmentShopState);

/** Drop leftover offerings when leaving a shop so runtime matches screen-gated encode. */
export function clearShopOfferings(draft: GameplayDraft): void {
  setShopState(draft, emptyShopState());
  setAlchemistState(draft, emptyAlchemistState());
  setTrinketShopState(draft, emptyTrinketShopState());
  setEquipmentShopState(draft, emptyEquipmentShopState());
}

export const setMysteryEvent = bindDraftAction((s) => sessionActions(s).setMysteryEvent);
export const setMysteryChosenChoice = bindDraftAction((s) => sessionActions(s).setMysteryChosenChoice);
export const setMysteryPendingRemoval = bindDraftAction((s) => sessionActions(s).setMysteryPendingRemoval);
export const setMysteryCardChoices = bindDraftAction((s) => sessionActions(s).setMysteryCardChoices);
export const setMysteryGrantedTrinketIds = bindDraftAction((s) => sessionActions(s).setMysteryGrantedTrinketIds);
export const setMysteryGrantedGearInstances = bindDraftAction((s) => sessionActions(s).setMysteryGrantedGearInstances);
export const setMysteryChosenCardId = bindDraftAction((s) => sessionActions(s).setMysteryChosenCardId);

export function clearMysteryVisitState(draft: GameplayDraft): void {
  setMysteryEvent(draft, null);
  setMysteryChosenChoice(draft, null);
  setMysteryPendingRemoval(draft, false);
  setMysteryCardChoices(draft, null);
  setMysteryGrantedTrinketIds(draft, []);
  setMysteryGrantedGearInstances(draft, []);
  setMysteryChosenCardId(draft, null);
}

export const setActiveLabyrinthModifiers = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthModifiers);
export const setActiveLabyrinthRewardModifiers = bindDraftAction(
  (s) => sessionActions(s).setActiveLabyrinthRewardModifiers,
);
export const setActiveLabyrinthPendingNode = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthPendingNode);
export const setLabyrinthMap = bindDraftAction((s) => sessionActions(s).setLabyrinthMap);
