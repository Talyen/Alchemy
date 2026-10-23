import type { Immutable } from "immer";
import { createEmptyRewardState, type RewardState } from "./reward-types";
import type { BattleCard } from "@/lib/game-data";
import { emptyAlchemyVisit, type AlchemyVisit } from "./alchemy-visits";
import type { BattleSnapshot } from "@/lib/battle";
import type { CorruptionResult } from "@/lib/corruption";
import type { Screen } from "@/lib/routing";
import { emptyHydratedMysteryVisit, type HydratedMysteryVisit } from "./mystery-visit-persistence";
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "./shop-session-types";
import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "./shop-session-types";

export interface RunActivityData {
  campfire: AlchemyVisit;
  transmutation: AlchemyVisit;
  shop: ShopState;
  alchemist: AlchemistState;
  "trinket-shop": TrinketShopState;
  "equipment-shop": EquipmentShopState;
  mystery: HydratedMysteryVisit;
  corruption: CorruptionResult | null;
}

type VisitActivity = { [K in keyof RunActivityData]: { kind: K; data: RunActivityData[K] } }[keyof RunActivityData];
export type RunProgressActivityKind = "labyrinth-map" | "wildwood-removal" | "draft-deck" | "difficulty-select";
interface ActiveBattle {
  battleState: BattleSnapshot;
}

export interface RewardActivityData {
  state: RewardState;
  companionCards: BattleCard[] | null;
}
export type DestinationActivityData = Pick<
  RewardState,
  "destinations" | "selectedBossId" | "lastVictoryEnemyType" | "lastVictoryContentSystem"
>;

export function destinationActivityData(state: RewardState): DestinationActivityData {
  const { destinations, selectedBossId, lastVictoryEnemyType, lastVictoryContentSystem } = state;
  return { destinations, selectedBossId, lastVictoryEnemyType, lastVictoryContentSystem };
}

export type RunActivity =
  | { kind: "inactive" | "idle" | RunProgressActivityKind }
  | { kind: "battle"; data: ActiveBattle }
  | { kind: "rewards"; data: RewardActivityData }
  | { kind: "destination"; data: DestinationActivityData }
  | VisitActivity;

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

const VISIT_FACTORIES: { readonly [K in keyof RunActivityData]: () => RunActivityData[K] } = {
  campfire: emptyAlchemyVisit,
  transmutation: emptyAlchemyVisit,
  shop: emptyShopState,
  alchemist: emptyAlchemistState,
  "trinket-shop": emptyTrinketShopState,
  "equipment-shop": emptyEquipmentShopState,
  mystery: emptyHydratedMysteryVisit,
  corruption: () => null,
};

const EMPTY_VISITS = deepFreeze(
  Object.fromEntries(Object.entries(VISIT_FACTORIES).map(([kind, create]) => [kind, create()])),
);

/**
 * Reads visit data for `kind`. The matching branch returns live mutable state;
 * the fallback is a shared deep-frozen empty visit — read-only, do not mutate.
 */
export function readActivityData<K extends keyof RunActivityData>(activity: RunActivity, kind: K): RunActivityData[K] {
  return (activity.kind === kind && "data" in activity ? activity.data : EMPTY_VISITS[kind]) as RunActivityData[K];
}

export function isActiveRunActivity(activity: RunActivity): boolean {
  return activity.kind !== "inactive";
}

export function runActivityScreen(activity: RunActivity): Screen | null {
  return activity.kind === "idle" || activity.kind === "inactive" ? null : activity.kind;
}

const emptyRewardActivity = deepFreeze({ state: createEmptyRewardState(), companionCards: null });
const rewardViews = new WeakMap<object, Immutable<RewardActivityData>>();

/** Compatibility read shape; the activity remains the sole owner of its payload. */
export function readRewardActivity(activity: RunActivity): RewardActivityData;
export function readRewardActivity(activity: Immutable<RunActivity>): Immutable<RewardActivityData>;
export function readRewardActivity(activity: Immutable<RunActivity>): Immutable<RewardActivityData> {
  if (activity.kind === "rewards") return activity.data;
  if (activity.kind !== "destination") return emptyRewardActivity;
  // Cache only committed data. Transactions must always see their latest writes.
  const immutable = Object.isFrozen(activity.data);
  const cached = immutable ? rewardViews.get(activity.data) : undefined;
  if (cached) return cached;
  const result = { state: { ...emptyRewardActivity.state, ...activity.data }, companionCards: null };
  if (immutable) {
    Object.freeze(result.state);
    rewardViews.set(activity.data, Object.freeze(result));
  }
  return result;
}
