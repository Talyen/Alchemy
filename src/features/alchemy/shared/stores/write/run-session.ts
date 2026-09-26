import { recordRunRoom } from "./run-recap";
import {
  emptyHydratedMysteryVisit,
  readActivityData,
  type HydratedMysteryVisit,
  type RunActivityData,
} from "@/lib/active-run-session";
import { enterWildwoodReward } from "@/lib/content-systems/wildwood/gauntlet";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { GameplayDraft } from "../run-session-command";
import { createInitialSessionFields, type RunRewardFlow, type RunSessionFields } from "../run-domain-types";
import { type FieldUpdate, defineDraftSetter } from "./write-field";
import { setCompletedDestinations, setDestinationIndexInAct, setDestinationOfferState } from "./run-progress";

// ── Session ──────────────────────────────────────────────────────────────────

function defineSessionSetter<K extends keyof RunSessionFields>(field: K) {
  return defineDraftSetter((draft: GameplayDraft) => draft.session, field);
}

export const setPendingCharacterId = defineSessionSetter("pendingCharacterId");

export const setPendingContentSystemType = defineSessionSetter("pendingContentSystemType");

export const setWildwoodDraft = defineSessionSetter("wildwoodDraft");

export const setStarterDraftChoices = defineSessionSetter("starterDraftChoices");

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  if (!active) draft.session.activity = { kind: "inactive" };
  else if (draft.session.activity.kind === "inactive") draft.session.activity = { kind: "idle" };
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

// ── Reward flow ──────────────────────────────────────────────────────────────

function defineRewardFlowSetter<K extends keyof RunRewardFlow>(field: K) {
  return defineDraftSetter((draft: GameplayDraft) => draft.session.rewardFlow, field);
}

export const setRewardState = defineRewardFlowSetter("state");

export const setCompanionRewardCards = defineRewardFlowSetter("companionCards");

export const setRunEndMaterials = defineSessionSetter("runEndMaterials");

export const setRunEndCurrencies = defineSessionSetter("runEndCurrencies");

export const setRunEndItems = defineSessionSetter("runEndItems");

export function setCorruptionResult(draft: GameplayDraft, result: RunActivityData["corruption"]): void {
  if (result === null && draft.session.activity.kind !== "corruption") return;
  draft.session.activity = { kind: "corruption", data: result };
}

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardFlow.claim.kind !== "idle") return false;
  draft.session.rewardFlow.claim = { kind: "reward" };
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  if (draft.session.rewardFlow.claim.kind === "reward") draft.session.rewardFlow.claim = { kind: "idle" };
}

export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const flow = draft.session.rewardFlow;
  if (flow.claim.kind !== "idle" || !flow.state.destinations.includes(destination)) return false;
  flow.claim = { kind: "destination", destination };
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  if (draft.session.rewardFlow.claim.kind === "destination") draft.session.rewardFlow.claim = { kind: "idle" };
}

export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const transient = draft.session;
  if (transient.rewardFlow.claim.kind !== "destination" || transient.rewardFlow.claim.destination !== destination)
    return false;
  if (!transient.rewardFlow.state.destinations.includes(destination)) {
    cancelDestinationClaim(draft);
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    setDestinationOfferState(draft, {
      lastOfferedDestinations: [...transient.rewardFlow.state.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  setRewardState(draft, (previous) => ({ ...previous, destinations: [] }));
  cancelDestinationClaim(draft);
  setCompletedDestinations(draft, (previous) => [...previous, destination]);
  setDestinationIndexInAct(draft, (previous) => previous + 1);
  const run = draft.run.activeRun;
  recordRunRoom(draft, destination, `campaign:${run.currentAct}:${run.destinationIndexInAct}:${destination}`);
  return true;
}

function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const transient = draft.session;

  if (transient.rewardFlow.claim.kind === "destination" && transient.rewardFlow.claim.destination === destination) {
    cancelDestinationClaim(draft);
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    setCompletedDestinations(draft, (previous) => previous.slice(0, -1));
    setDestinationIndexInAct(draft, (previous) => Math.max(0, previous - 1));
  }

  if (transient.rewardFlow.state.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      setRewardState(draft, (previous) => ({ ...previous, destinations: restored }));
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

// ── Shop / visit state ───────────────────────────────────────────────────────

type ActivityUpdate<K extends keyof RunActivityData> = FieldUpdate<RunActivityData[K]>;

function readVisit<K extends keyof RunActivityData>(draft: GameplayDraft, kind: K): RunActivityData[K] {
  return readActivityData(draft.session.activity, kind);
}

function setVisitState<K extends keyof RunActivityData>(
  draft: GameplayDraft,
  kind: K,
  action: ActivityUpdate<K>,
): void {
  const data = typeof action === "function" ? action(readVisit(draft, kind)) : action;
  draft.session.activity = { kind, data } as GameplayDraft["session"]["activity"];
}

function defineVisitSetter<K extends keyof RunActivityData>(kind: K) {
  return (draft: GameplayDraft, action: ActivityUpdate<K>): void => {
    setVisitState(draft, kind, action);
  };
}

export const setShopState = defineVisitSetter("shop");

export const setAlchemistState = defineVisitSetter("alchemist");

export const setTrinketShopState = defineVisitSetter("trinket-shop");

export const setEquipmentShopState = defineVisitSetter("equipment-shop");

export function clearShopOfferings(draft: GameplayDraft): void {
  if (["shop", "alchemist", "trinket-shop", "equipment-shop"].includes(draft.session.activity.kind)) {
    draft.session.activity = { kind: "idle" };
  }
}

// ── Labyrinth session ────────────────────────────────────────────────────────

export const setActiveLabyrinthModifiers = defineSessionSetter("activeLabyrinthModifiers");

export const setActiveLabyrinthRewardModifiers = defineSessionSetter("activeLabyrinthRewardModifiers");

export const setActiveLabyrinthPendingNode = defineSessionSetter("activeLabyrinthPendingNode");

export const setSelectedLabyrinthNodeId = defineSessionSetter("selectedLabyrinthNodeId");

export const setRunEndLabyrinthFloor = defineSessionSetter("runEndLabyrinthFloor");

export const setLabyrinthMap = defineSessionSetter("labyrinthMap");

// ── Mystery visit ────────────────────────────────────────────────────────────

function setMysteryVisitField<K extends keyof HydratedMysteryVisit>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<HydratedMysteryVisit[K]>,
): void {
  if (draft.session.activity.kind !== "mystery") {
    draft.session.activity = { kind: "mystery", data: emptyHydratedMysteryVisit() };
  }
  const visit = draft.session.activity.data;
  visit[field] = typeof action === "function" ? action(visit[field]) : action;
}

function defineMysteryVisitSetter<K extends keyof HydratedMysteryVisit>(field: K) {
  return (draft: GameplayDraft, action: FieldUpdate<HydratedMysteryVisit[K]>): void => {
    setMysteryVisitField(draft, field, action);
  };
}

export const setMysteryEvent = defineMysteryVisitSetter("mysteryEvent");

export const setMysteryChosenChoice = defineMysteryVisitSetter("mysteryChosenChoice");

// Legacy: only stale-visit clearing and tests write this; no live navigation sets it.
export const setMysteryPendingRemoval = defineMysteryVisitSetter("mysteryPendingRemoval");

export const setMysteryCardChoices = defineMysteryVisitSetter("mysteryCardChoices");

export const setMysteryGrantedTrinketIds = defineMysteryVisitSetter("mysteryGrantedTrinketIds");

export const setMysteryGrantedGearInstances = defineMysteryVisitSetter("mysteryGrantedGearInstances");

export const setMysteryChosenCardId = defineMysteryVisitSetter("mysteryChosenCardId");

export function clearMysteryVisitState(draft: GameplayDraft): void {
  if (draft.session.activity.kind === "mystery") draft.session.activity = { kind: "idle" };
}

// ── Wildwood ─────────────────────────────────────────────────────────────────

export function enterWildwoodVictory(draft: GameplayDraft): void {
  const wildwood = draft.session.wildwoodDraft;
  if (!wildwood) return;
  const reward = enterWildwoodReward(wildwood);
  if (reward) setWildwoodDraft(draft, reward);
}
