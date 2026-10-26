import type { BattleCard } from "@/lib/game-data";
import { recordRunRoom } from "./run-recap";
import {
  emptyHydratedMysteryVisit,
  readRewardActivity,
  destinationActivityData,
  type RewardState,
  readActivityData,
  type HydratedMysteryVisit,
  type RunActivityData,
  type RunProgressActivityKind,
} from "@/lib/active-run-session";
import { enterWildwoodReward } from "@/lib/content-systems/wildwood/gauntlet";
import { DESTINATIONS, type Destination, type Screen } from "@/lib/routing";
import type { GameplayDraft } from "../../session/gameplay-command";
import { createInitialSessionFields, type RunSessionFields } from "../../session/run-domain-types";
import type { FieldUpdate } from "../../session/transaction-internal";
import { defineDraftSetter } from "../../session/transaction-internal";
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

/** Domain commands establish resumable progress before presentation changes. */
export function setRunProgressActivity(
  draft: GameplayDraft,
  kind: RunProgressActivityKind | "rewards" | "destination",
): void {
  if (draft.session.activity.kind !== "inactive" && draft.session.activity.kind !== kind) {
    const reward = readRewardActivity(draft.session.activity);
    draft.session.activity =
      kind === "rewards"
        ? { kind, data: reward }
        : kind === "destination"
          ? { kind, data: destinationActivityData(reward.state) }
          : { kind };
  }
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

export function setAlchemyVisit(
  draft: GameplayDraft,
  kind: "campfire" | "transmutation",
  data: RunActivityData["campfire"],
): void {
  draft.session.activity = { kind, data };
}

export function setScreen(draft: GameplayDraft, action: Screen | ((previous: Screen) => Screen)): void {
  const screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
  draft.run.navigation.screen = screen;
  if (
    screen === "armory" &&
    (draft.gear.ownedTrinketIds.length > 0 || Object.values(draft.gear.inventories).some((items) => items.length > 0))
  ) {
    draft.profile.hasSeenArmory = true;
  }
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
}

// ── Reward flow ──────────────────────────────────────────────────────────────

export function setRewardState(draft: GameplayDraft, action: FieldUpdate<RewardState>): void {
  const previous = readRewardActivity(draft.session.activity);
  const state = typeof action === "function" ? action(previous.state) : action;
  draft.session.activity = { kind: "rewards", data: { state, companionCards: previous.companionCards } };
}

/** Updating an offer cannot construct a reward phase or retain stale choices. */
export function setDestinationState(draft: GameplayDraft, action: FieldUpdate<RewardState>): void {
  const previous = readRewardActivity(draft.session.activity).state;
  const state = typeof action === "function" ? action(previous) : action;
  draft.session.activity = { kind: "destination", data: destinationActivityData(state) };
}

export function setCompanionRewardCards(draft: GameplayDraft, companionCards: BattleCard[] | null): void {
  if (draft.session.activity.kind === "rewards") draft.session.activity.data.companionCards = companionCards;
  else if (companionCards)
    draft.session.activity = {
      kind: "rewards",
      data: { state: readRewardActivity(draft.session.activity).state, companionCards },
    };
}

export const setRunEndMaterials = defineSessionSetter("runEndMaterials");

export const setRunEndCurrencies = defineSessionSetter("runEndCurrencies");

export const setRunEndItems = defineSessionSetter("runEndItems");

export function setCorruptionResult(draft: GameplayDraft, result: RunActivityData["corruption"]): void {
  if (result === null && draft.session.activity.kind !== "corruption") return;
  draft.session.activity = { kind: "corruption", data: result };
}

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.progressClaim.kind !== "idle") return false;
  draft.session.progressClaim = { kind: "reward" };
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  if (draft.session.progressClaim.kind === "reward") draft.session.progressClaim = { kind: "idle" };
}

export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const state = readRewardActivity(draft.session.activity).state;
  if (draft.session.progressClaim.kind !== "idle" || !state.destinations.includes(destination)) return false;
  draft.session.progressClaim = { kind: "destination", destination, offer: destinationActivityData(state) };
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  if (draft.session.progressClaim.kind === "destination") draft.session.progressClaim = { kind: "idle" };
}

export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const transient = draft.session;
  if (transient.progressClaim.kind !== "destination" || transient.progressClaim.destination !== destination)
    return false;
  const offer = transient.progressClaim.offer;
  if (!offer.destinations.includes(destination)) {
    cancelDestinationClaim(draft);
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    setDestinationOfferState(draft, {
      lastOfferedDestinations: [...offer.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  if (transient.activity.kind === "destination") transient.activity.data.destinations = [];
  cancelDestinationClaim(draft);
  setCompletedDestinations(draft, (previous) => [...previous, destination]);
  setDestinationIndexInAct(draft, (previous) => previous + 1);
  const run = draft.run.activeRun;
  recordRunRoom(draft, destination, `campaign:${run.currentAct}:${run.destinationIndexInAct}:${destination}`);
  return true;
}

function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const transient = draft.session;

  if (transient.progressClaim.kind === "destination" && transient.progressClaim.destination === destination) {
    cancelDestinationClaim(draft);
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    setCompletedDestinations(draft, (previous) => previous.slice(0, -1));
    setDestinationIndexInAct(draft, (previous) => Math.max(0, previous - 1));
  }

  const previous = readRewardActivity(transient.activity).state;
  const destinations = previous.destinations.length
    ? previous.destinations
    : [...draft.run.activeRun.lastOfferedDestinations];
  setDestinationState(draft, { ...previous, destinations });
}

export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

export function abandonLabyrinthCorruptionVisit(draft: GameplayDraft): void {
  setCorruptionResult(draft, null);
  draft.session.activeLabyrinthPendingNode = null;
  draft.session.selectedLabyrinthNodeId = null;
  setRunProgressActivity(draft, "labyrinth-map");
}

export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

// ── Shop / visit state ───────────────────────────────────────────────────────

type ActivityUpdate<K extends keyof RunActivityData> = FieldUpdate<RunActivityData[K]>;

function readVisit<K extends keyof RunActivityData>(draft: GameplayDraft, kind: K): RunActivityData[K] {
  return readActivityData(draft.session.activity, kind);
}

export function setRunActivityData<K extends keyof RunActivityData>(
  draft: GameplayDraft,
  kind: K,
  action: ActivityUpdate<NoInfer<K>>,
): void {
  const data = typeof action === "function" ? action(readVisit(draft, kind)) : action;
  draft.session.activity = { kind, data } as GameplayDraft["session"]["activity"];
}

function defineVisitSetter<K extends keyof RunActivityData>(kind: K) {
  return (draft: GameplayDraft, action: ActivityUpdate<K>): void => {
    setRunActivityData(draft, kind, action);
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

export const setMysteryCardChoices = defineMysteryVisitSetter("mysteryCardChoices");

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
