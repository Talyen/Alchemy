import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { GameplayDraft } from "./run-session-command";
import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import {
  hydrateFromSnapshot,
  setCompletedDestinations,
  setDestinationIndexInAct,
  setDestinationOfferState,
} from "./write-port-run";
import { createDraftFieldSetter } from "./write-port-run";

const createSessionFieldSetter = createDraftFieldSetter<RunSessionFields, GameplayDraft>((draft) => draft.session);

export const setPendingCharacterId = createSessionFieldSetter("pendingCharacterId");
export const setPendingContentSystemType = createSessionFieldSetter("pendingContentSystemType");
export const setWildwoodDraft = createSessionFieldSetter("wildwoodDraft");
export const setStarterDraftChoices = createSessionFieldSetter("starterDraftChoices");

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  draft.session.hasActiveRun = active;
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndLabyrinthFloor = null;
  draft.session.hasActiveRun = snapshot.hasActiveRun;
}

export const setRewardState = createSessionFieldSetter("rewardState");
export const setCompanionRewardCards = createSessionFieldSetter("companionRewardCards");
export const setRunEndMaterials = createSessionFieldSetter("runEndMaterials");
export const setRunEndItems = createSessionFieldSetter("runEndItems");
export const setCorruptionResult = createSessionFieldSetter("corruptionResult");

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardClaimInFlight) return false;
  if (draft.session.rewardState.choices.length === 0 && !draft.session.companionRewardCards?.length) return false;
  draft.session.rewardClaimInFlight = true;
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  draft.session.rewardClaimInFlight = false;
}

export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  if (draft.session.pendingDestinationClaim !== null) return false;
  if (!draft.session.rewardState.destinations.includes(destination)) return false;
  draft.session.pendingDestinationClaim = destination;
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  draft.session.pendingDestinationClaim = null;
}

export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const transient = draft.session;
  if (transient.pendingDestinationClaim !== destination) return false;
  if (!transient.rewardState.destinations.includes(destination)) {
    cancelDestinationClaim(draft);
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    setDestinationOfferState(draft, {
      lastOfferedDestinations: [...transient.rewardState.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  setRewardState(draft, (prev) => ({ ...prev, destinations: [] }));
  cancelDestinationClaim(draft);
  setCompletedDestinations(draft, (prev) => [...prev, destination]);
  setDestinationIndexInAct(draft, (prev) => prev + 1);
  return true;
}

function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const transient = draft.session;

  if (transient.pendingDestinationClaim === destination) {
    cancelDestinationClaim(draft);
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    setCompletedDestinations(draft, (prev) => prev.slice(0, -1));
    setDestinationIndexInAct(draft, (prev) => Math.max(0, prev - 1));
  }

  if (transient.rewardState.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      setRewardState(draft, (prev) => ({ ...prev, destinations: restored }));
    }
  }

  if (destination === DESTINATIONS.CORRUPTION) {
    setCorruptionResult(draft, null);
  }
}

export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

export const setShopState = createSessionFieldSetter("shopState");
export const setAlchemistState = createSessionFieldSetter("alchemistState");
export const setTrinketShopState = createSessionFieldSetter("trinketShopState");
export const setEquipmentShopState = createSessionFieldSetter("equipmentShopState");

export function clearShopOfferings(draft: GameplayDraft): void {
  setShopState(draft, emptyShopState());
  setAlchemistState(draft, emptyAlchemistState());
  setTrinketShopState(draft, emptyTrinketShopState());
  setEquipmentShopState(draft, emptyEquipmentShopState());
}

export const setActiveLabyrinthModifiers = createSessionFieldSetter("activeLabyrinthModifiers");
export const setActiveLabyrinthRewardModifiers = createSessionFieldSetter("activeLabyrinthRewardModifiers");
export const setActiveLabyrinthPendingNode = createSessionFieldSetter("activeLabyrinthPendingNode");
export const setSelectedLabyrinthNodeId = createSessionFieldSetter("selectedLabyrinthNodeId");
export const setRunEndLabyrinthFloor = createSessionFieldSetter("runEndLabyrinthFloor");
export const setLabyrinthMap = createSessionFieldSetter("labyrinthMap");

export const setMysteryEvent = createSessionFieldSetter("mysteryEvent");
export const setMysteryChosenChoice = createSessionFieldSetter("mysteryChosenChoice");
export const setMysteryPendingRemoval = createSessionFieldSetter("mysteryPendingRemoval");
export const setMysteryCardChoices = createSessionFieldSetter("mysteryCardChoices");
export const setMysteryGrantedTrinketIds = createSessionFieldSetter("mysteryGrantedTrinketIds");
export const setMysteryGrantedGearInstances = createSessionFieldSetter("mysteryGrantedGearInstances");
export const setMysteryChosenCardId = createSessionFieldSetter("mysteryChosenCardId");

export function clearMysteryVisitState(draft: GameplayDraft): void {
  setMysteryEvent(draft, null);
  setMysteryChosenChoice(draft, null);
  setMysteryPendingRemoval(draft, false);
  setMysteryCardChoices(draft, null);
  setMysteryGrantedTrinketIds(draft, []);
  setMysteryGrantedGearInstances(draft, []);
  setMysteryChosenCardId(draft, null);
}
