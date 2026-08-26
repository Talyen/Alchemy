import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session";
import type {
  AlchemistState,
  EquipmentShopState,
  RewardState,
  ShopState,
  TrinketShopState,
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

/** Set a session field from a direct value or an updater over the previous value. */
function setSessionField<K extends keyof RunSessionFields>(
  draft: GameplayDraft,
  field: K,
  action: RunSessionFields[K] | ((prev: RunSessionFields[K]) => RunSessionFields[K]),
): void {
  draft.session[field] = typeof action === "function" ? action(draft.session[field]) : action;
}

export const setPendingCharacterId = (draft: GameplayDraft, id: RunSessionFields["pendingCharacterId"]) =>
  setSessionField(draft, "pendingCharacterId", id);
export const setPendingContentSystemType = (draft: GameplayDraft, type: RunSessionFields["pendingContentSystemType"]) =>
  setSessionField(draft, "pendingContentSystemType", type);
export const setWildwoodDraft = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["wildwoodDraft"]
    | ((prev: RunSessionFields["wildwoodDraft"]) => RunSessionFields["wildwoodDraft"]),
) => setSessionField(draft, "wildwoodDraft", action);
export const setStarterDraftChoices = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["starterDraftChoices"]
    | ((prev: RunSessionFields["starterDraftChoices"]) => RunSessionFields["starterDraftChoices"]),
) => setSessionField(draft, "starterDraftChoices", action);

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  draft.session.hasActiveRun = active;
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

/** Start a fresh run: seed active-run progress, drop the previous run-end snapshots, flag the run active. */
export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndLabyrinthFloor = null;
  draft.session.hasActiveRun = snapshot.hasActiveRun;
}

export const setRewardState = (draft: GameplayDraft, action: RewardState | ((prev: RewardState) => RewardState)) =>
  setSessionField(draft, "rewardState", action);
export const setCompanionRewardCards = (draft: GameplayDraft, cards: RunSessionFields["companionRewardCards"]) =>
  setSessionField(draft, "companionRewardCards", cards);
export const setRunEndMaterials = (draft: GameplayDraft, materials: RunSessionFields["runEndMaterials"]) =>
  setSessionField(draft, "runEndMaterials", materials);
export const setRunEndItems = (draft: GameplayDraft, items: RunSessionFields["runEndItems"]) =>
  setSessionField(draft, "runEndItems", items);
export const setCorruptionResult = (draft: GameplayDraft, result: RunSessionFields["corruptionResult"]) =>
  setSessionField(draft, "corruptionResult", result);

/** Claim reward-screen focus once per pending reward; false when nothing is claimable or already claimed. */
export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardClaimInFlight) return false;
  if (draft.session.rewardState.choices.length === 0 && !draft.session.companionRewardCards?.length) return false;
  draft.session.rewardClaimInFlight = true;
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  draft.session.rewardClaimInFlight = false;
}

/** Reserve one destination for claiming; false when another claim is open or the destination is not offered. */
export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  if (draft.session.pendingDestinationClaim !== null) return false;
  if (!draft.session.rewardState.destinations.includes(destination)) return false;
  draft.session.pendingDestinationClaim = destination;
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  draft.session.pendingDestinationClaim = null;
}

/** Commit destination claim across session + active-run progress (cross-lifetime). */
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

/** Undo a destination visit that never resolved so the same picker returns. */
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

/** Undo a Corruption visit that never mutated a card so the same destination picker returns. */
export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

/** Undo a Mystery visit whose event could not be restored. */
export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

export const setShopState = (draft: GameplayDraft, action: ShopState | ((prev: ShopState) => ShopState)) =>
  setSessionField(draft, "shopState", action);
export const setAlchemistState = (
  draft: GameplayDraft,
  action: AlchemistState | ((prev: AlchemistState) => AlchemistState),
) => setSessionField(draft, "alchemistState", action);
export const setTrinketShopState = (
  draft: GameplayDraft,
  action: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState),
) => setSessionField(draft, "trinketShopState", action);
export const setEquipmentShopState = (
  draft: GameplayDraft,
  action: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState),
) => setSessionField(draft, "equipmentShopState", action);

/** Drop leftover offerings when leaving a shop so runtime matches screen-gated encode. */
export function clearShopOfferings(draft: GameplayDraft): void {
  setShopState(draft, emptyShopState());
  setAlchemistState(draft, emptyAlchemistState());
  setTrinketShopState(draft, emptyTrinketShopState());
  setEquipmentShopState(draft, emptyEquipmentShopState());
}

export const setActiveLabyrinthModifiers = (
  draft: GameplayDraft,
  modifiers: RunSessionFields["activeLabyrinthModifiers"],
) => setSessionField(draft, "activeLabyrinthModifiers", modifiers);
export const setActiveLabyrinthRewardModifiers = (
  draft: GameplayDraft,
  modifiers: RunSessionFields["activeLabyrinthRewardModifiers"],
) => setSessionField(draft, "activeLabyrinthRewardModifiers", modifiers);
export const setActiveLabyrinthPendingNode = (
  draft: GameplayDraft,
  node: RunSessionFields["activeLabyrinthPendingNode"],
) => setSessionField(draft, "activeLabyrinthPendingNode", node);
export const setSelectedLabyrinthNodeId = (draft: GameplayDraft, nodeId: RunSessionFields["selectedLabyrinthNodeId"]) =>
  setSessionField(draft, "selectedLabyrinthNodeId", nodeId);
export const setRunEndLabyrinthFloor = (draft: GameplayDraft, floor: RunSessionFields["runEndLabyrinthFloor"]) =>
  setSessionField(draft, "runEndLabyrinthFloor", floor);
export const setLabyrinthMap = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["labyrinthMap"]
    | ((prev: RunSessionFields["labyrinthMap"]) => RunSessionFields["labyrinthMap"]),
) => setSessionField(draft, "labyrinthMap", action);

export const setMysteryEvent = (draft: GameplayDraft, event: RunSessionFields["mysteryEvent"]) =>
  setSessionField(draft, "mysteryEvent", event);
export const setMysteryChosenChoice = (draft: GameplayDraft, choice: RunSessionFields["mysteryChosenChoice"]) =>
  setSessionField(draft, "mysteryChosenChoice", choice);
export const setMysteryPendingRemoval = (draft: GameplayDraft, pending: RunSessionFields["mysteryPendingRemoval"]) =>
  setSessionField(draft, "mysteryPendingRemoval", pending);
export const setMysteryCardChoices = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["mysteryCardChoices"]
    | ((prev: RunSessionFields["mysteryCardChoices"]) => RunSessionFields["mysteryCardChoices"]),
) => setSessionField(draft, "mysteryCardChoices", action);
export const setMysteryGrantedTrinketIds = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["mysteryGrantedTrinketIds"]
    | ((prev: RunSessionFields["mysteryGrantedTrinketIds"]) => RunSessionFields["mysteryGrantedTrinketIds"]),
) => setSessionField(draft, "mysteryGrantedTrinketIds", action);
export const setMysteryGrantedGearInstances = (
  draft: GameplayDraft,
  action:
    | RunSessionFields["mysteryGrantedGearInstances"]
    | ((prev: RunSessionFields["mysteryGrantedGearInstances"]) => RunSessionFields["mysteryGrantedGearInstances"]),
) => setSessionField(draft, "mysteryGrantedGearInstances", action);
export const setMysteryChosenCardId = (draft: GameplayDraft, id: RunSessionFields["mysteryChosenCardId"]) =>
  setSessionField(draft, "mysteryChosenCardId", id);

export function clearMysteryVisitState(draft: GameplayDraft): void {
  setMysteryEvent(draft, null);
  setMysteryChosenChoice(draft, null);
  setMysteryPendingRemoval(draft, false);
  setMysteryCardChoices(draft, null);
  setMysteryGrantedTrinketIds(draft, []);
  setMysteryGrantedGearInstances(draft, []);
  setMysteryChosenCardId(draft, null);
}
