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
export type RunProgressActivityKind =
  | "rewards"
  | "destination"
  | "labyrinth-map"
  | "wildwood-removal"
  | "draft-deck"
  | "difficulty-select";
interface ActiveBattle {
  battleState: BattleSnapshot;
  battleStartState: BattleSnapshot | null;
}

export type RunActivity =
  | { kind: "inactive" | "idle" | RunProgressActivityKind }
  | { kind: "battle"; data: ActiveBattle }
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
