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
  shop: ShopState;
  alchemist: AlchemistState;
  "trinket-shop": TrinketShopState;
  "equipment-shop": EquipmentShopState;
  mystery: HydratedMysteryVisit;
  corruption: CorruptionResult | null;
}

type VisitActivity = { [K in keyof RunActivityData]: { kind: K; data: RunActivityData[K] } }[keyof RunActivityData];
type ProgressActivityKind =
  | "battle"
  | "rewards"
  | "destination"
  | "campfire"
  | "labyrinth-map"
  | "wildwood-removal"
  | "draft-deck"
  | "difficulty-select";
export type RunActivity = { kind: "inactive" | "idle" | ProgressActivityKind } | VisitActivity;

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

const EMPTY_VISITS: Readonly<RunActivityData> = deepFreeze({
  shop: emptyShopState(),
  alchemist: emptyAlchemistState(),
  "trinket-shop": emptyTrinketShopState(),
  "equipment-shop": emptyEquipmentShopState(),
  mystery: emptyHydratedMysteryVisit(),
  corruption: null,
});

/**
 * Reads visit data for `kind`. The matching branch returns live mutable state;
 * the fallback is a shared deep-frozen empty visit — read-only, do not mutate.
 */
export function readActivityData<K extends keyof RunActivityData>(activity: RunActivity, kind: K): RunActivityData[K] {
  return activity.kind === kind && "data" in activity ? (activity.data as RunActivityData[K]) : EMPTY_VISITS[kind];
}

export function isActiveRunActivity(activity: RunActivity): boolean {
  return activity.kind !== "inactive";
}

export function runActivityScreen(activity: RunActivity): Screen | null {
  return activity.kind === "idle" || activity.kind === "inactive" ? null : activity.kind;
}

const ACTIVITY_FACTORIES: Partial<Record<Screen, () => RunActivity>> = {
  shop: () => ({ kind: "shop", data: emptyShopState() }),
  alchemist: () => ({ kind: "alchemist", data: emptyAlchemistState() }),
  "trinket-shop": () => ({ kind: "trinket-shop", data: emptyTrinketShopState() }),
  "equipment-shop": () => ({ kind: "equipment-shop", data: emptyEquipmentShopState() }),
  mystery: () => ({ kind: "mystery", data: emptyHydratedMysteryVisit() }),
  corruption: () => ({ kind: "corruption", data: null }),
};

const STATELESS_RUN_SCREENS = new Set<ProgressActivityKind>([
  "battle",
  "rewards",
  "destination",
  "campfire",
  "labyrinth-map",
  "wildwood-removal",
  "draft-deck",
  "difficulty-select",
]);

export function transitionRunActivity(activity: RunActivity, screen: Screen): RunActivity {
  if (activity.kind === screen) return activity;
  const factory = ACTIVITY_FACTORIES[screen];
  if (factory) return factory();
  if (STATELESS_RUN_SCREENS.has(screen as ProgressActivityKind)) {
    return { kind: screen as ProgressActivityKind };
  }
  return activity;
}
