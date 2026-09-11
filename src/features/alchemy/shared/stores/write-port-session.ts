import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import {
  emptyHydratedMysteryVisit,
  readActivityData,
  type HydratedMysteryVisit,
  type RunActivityData,
} from "@/lib/active-run-session";
import { enterWildwoodReward } from "@/lib/content-systems/wildwood/gauntlet";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import type { GameplayDraft } from "./run-session-command";
import {
  createDraftFieldSetter,
  hydrateFromSnapshot,
  setCompletedDestinations,
  setDestinationIndexInAct,
  setDestinationOfferState,
} from "./write-port-run";

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
export function setCorruptionResult(draft: GameplayDraft, result: RunActivityData["corruption"]): void {
  if (result === null && draft.session.activity.kind !== "corruption") return;
  draft.session.activity = { kind: "corruption", data: result };
}

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardClaimInFlight) return false;
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

export function abandonLabyrinthCorruptionVisit(draft: GameplayDraft): void {
  setCorruptionResult(draft, null);
  draft.session.activeLabyrinthPendingNode = null;
  draft.session.selectedLabyrinthNodeId = null;
}

export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

type ActivityUpdate<K extends keyof RunActivityData> =
  | RunActivityData[K]
  | ((previous: RunActivityData[K]) => RunActivityData[K]);

function updateVisit<K extends keyof RunActivityData>(
  draft: GameplayDraft,
  kind: K,
  action: ActivityUpdate<K>,
): RunActivityData[K] {
  return typeof action === "function" ? action(readActivityData(draft.session.activity, kind)) : action;
}

export function setShopState(draft: GameplayDraft, action: ActivityUpdate<"shop">): void {
  draft.session.activity = { kind: "shop", data: updateVisit(draft, "shop", action) };
}
export function setAlchemistState(draft: GameplayDraft, action: ActivityUpdate<"alchemist">): void {
  draft.session.activity = { kind: "alchemist", data: updateVisit(draft, "alchemist", action) };
}
export function setTrinketShopState(draft: GameplayDraft, action: ActivityUpdate<"trinket-shop">): void {
  draft.session.activity = { kind: "trinket-shop", data: updateVisit(draft, "trinket-shop", action) };
}
export function setEquipmentShopState(draft: GameplayDraft, action: ActivityUpdate<"equipment-shop">): void {
  draft.session.activity = { kind: "equipment-shop", data: updateVisit(draft, "equipment-shop", action) };
}

export function clearShopOfferings(draft: GameplayDraft): void {
  if (["shop", "alchemist", "trinket-shop", "equipment-shop"].includes(draft.session.activity.kind)) {
    draft.session.activity = { kind: "idle" };
  }
}

export const setActiveLabyrinthModifiers = createSessionFieldSetter("activeLabyrinthModifiers");
export const setActiveLabyrinthRewardModifiers = createSessionFieldSetter("activeLabyrinthRewardModifiers");
export const setActiveLabyrinthPendingNode = createSessionFieldSetter("activeLabyrinthPendingNode");
export const setSelectedLabyrinthNodeId = createSessionFieldSetter("selectedLabyrinthNodeId");
export const setRunEndLabyrinthFloor = createSessionFieldSetter("runEndLabyrinthFloor");
export const setLabyrinthMap = createSessionFieldSetter("labyrinthMap");

function createMysteryFieldSetter<K extends keyof HydratedMysteryVisit>(field: K) {
  return (
    draft: GameplayDraft,
    action: HydratedMysteryVisit[K] | ((previous: HydratedMysteryVisit[K]) => HydratedMysteryVisit[K]),
  ) => {
    if (draft.session.activity.kind !== "mystery") {
      draft.session.activity = { kind: "mystery", data: emptyHydratedMysteryVisit() };
    }
    const visit = draft.session.activity.data;
    visit[field] = typeof action === "function" ? action(visit[field]) : action;
  };
}

export const setMysteryEvent = createMysteryFieldSetter("mysteryEvent");
export const setMysteryChosenChoice = createMysteryFieldSetter("mysteryChosenChoice");
export const setMysteryPendingRemoval = createMysteryFieldSetter("mysteryPendingRemoval");
export const setMysteryCardChoices = createMysteryFieldSetter("mysteryCardChoices");
export const setMysteryGrantedTrinketIds = createMysteryFieldSetter("mysteryGrantedTrinketIds");
export const setMysteryGrantedGearInstances = createMysteryFieldSetter("mysteryGrantedGearInstances");
export const setMysteryChosenCardId = createMysteryFieldSetter("mysteryChosenCardId");

export function clearMysteryVisitState(draft: GameplayDraft): void {
  if (draft.session.activity.kind === "mystery") draft.session.activity = { kind: "idle" };
}

export function enterWildwoodVictory(draft: GameplayDraft): void {
  const wildwood = draft.session.wildwoodDraft;
  if (!wildwood) return;
  const reward = enterWildwoodReward(wildwood);
  if (reward) setWildwoodDraft(draft, reward);
}
