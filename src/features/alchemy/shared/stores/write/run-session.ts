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
import { type FieldUpdate, setField } from "./write-field";
import { setCompletedDestinations, setDestinationIndexInAct, setDestinationOfferState } from "./run-progress";

// ── Session ──────────────────────────────────────────────────────────────────

function setSessionField<K extends keyof RunSessionFields>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<RunSessionFields[K]>,
): void {
  setField(draft.session, field, action);
}

export function setPendingCharacterId(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["pendingCharacterId"]>,
): void {
  setSessionField(draft, "pendingCharacterId", action);
}

export function setPendingContentSystemType(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["pendingContentSystemType"]>,
): void {
  setSessionField(draft, "pendingContentSystemType", action);
}

export function setWildwoodDraft(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["wildwoodDraft"]>): void {
  setSessionField(draft, "wildwoodDraft", action);
}

export function setStarterDraftChoices(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["starterDraftChoices"]>,
): void {
  setSessionField(draft, "starterDraftChoices", action);
}

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  if (!active) draft.session.activity = { kind: "inactive" };
  else if (draft.session.activity.kind === "inactive") draft.session.activity = { kind: "idle" };
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

// ── Reward flow ──────────────────────────────────────────────────────────────

function setRewardFlowField<K extends keyof RunRewardFlow>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<RunRewardFlow[K]>,
): void {
  setField(draft.session.rewardFlow, field, action);
}

export function setRewardState(draft: GameplayDraft, action: FieldUpdate<RunRewardFlow["state"]>): void {
  setRewardFlowField(draft, "state", action);
}

export function setCompanionRewardCards(
  draft: GameplayDraft,
  action: FieldUpdate<RunRewardFlow["companionCards"]>,
): void {
  setRewardFlowField(draft, "companionCards", action);
}

export function setRunEndMaterials(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndMaterials"]>,
): void {
  setSessionField(draft, "runEndMaterials", action);
}

export function setRunEndCurrencies(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndCurrencies"]>,
): void {
  setSessionField(draft, "runEndCurrencies", action);
}

export function setRunEndItems(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["runEndItems"]>): void {
  setSessionField(draft, "runEndItems", action);
}

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

export function setShopState(draft: GameplayDraft, action: ActivityUpdate<"shop">): void {
  setVisitState(draft, "shop", action);
}

export function setAlchemistState(draft: GameplayDraft, action: ActivityUpdate<"alchemist">): void {
  setVisitState(draft, "alchemist", action);
}

export function setTrinketShopState(draft: GameplayDraft, action: ActivityUpdate<"trinket-shop">): void {
  setVisitState(draft, "trinket-shop", action);
}

export function setEquipmentShopState(draft: GameplayDraft, action: ActivityUpdate<"equipment-shop">): void {
  setVisitState(draft, "equipment-shop", action);
}

export function clearShopOfferings(draft: GameplayDraft): void {
  if (["shop", "alchemist", "trinket-shop", "equipment-shop"].includes(draft.session.activity.kind)) {
    draft.session.activity = { kind: "idle" };
  }
}

// ── Labyrinth session ────────────────────────────────────────────────────────

export function setActiveLabyrinthModifiers(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthModifiers"]>,
): void {
  setSessionField(draft, "activeLabyrinthModifiers", action);
}

export function setActiveLabyrinthRewardModifiers(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthRewardModifiers"]>,
): void {
  setSessionField(draft, "activeLabyrinthRewardModifiers", action);
}

export function setActiveLabyrinthPendingNode(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthPendingNode"]>,
): void {
  setSessionField(draft, "activeLabyrinthPendingNode", action);
}

export function setSelectedLabyrinthNodeId(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["selectedLabyrinthNodeId"]>,
): void {
  setSessionField(draft, "selectedLabyrinthNodeId", action);
}

export function setRunEndLabyrinthFloor(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndLabyrinthFloor"]>,
): void {
  setSessionField(draft, "runEndLabyrinthFloor", action);
}

export function setLabyrinthMap(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["labyrinthMap"]>): void {
  setSessionField(draft, "labyrinthMap", action);
}

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

export function setMysteryEvent(draft: GameplayDraft, action: FieldUpdate<HydratedMysteryVisit["mysteryEvent"]>): void {
  setMysteryVisitField(draft, "mysteryEvent", action);
}

export function setMysteryChosenChoice(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryChosenChoice"]>,
): void {
  setMysteryVisitField(draft, "mysteryChosenChoice", action);
}

export function setMysteryPendingRemoval(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryPendingRemoval"]>,
): void {
  // Legacy: only stale-visit clearing and tests write this; no live navigation sets it.
  setMysteryVisitField(draft, "mysteryPendingRemoval", action);
}

export function setMysteryCardChoices(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryCardChoices"]>,
): void {
  setMysteryVisitField(draft, "mysteryCardChoices", action);
}

export function setMysteryGrantedTrinketIds(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryGrantedTrinketIds"]>,
): void {
  setMysteryVisitField(draft, "mysteryGrantedTrinketIds", action);
}

export function setMysteryGrantedGearInstances(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryGrantedGearInstances"]>,
): void {
  setMysteryVisitField(draft, "mysteryGrantedGearInstances", action);
}

export function setMysteryChosenCardId(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryChosenCardId"]>,
): void {
  setMysteryVisitField(draft, "mysteryChosenCardId", action);
}

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
