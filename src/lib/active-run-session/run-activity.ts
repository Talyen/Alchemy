import { emptyAlchemyVisit, type AlchemyVisit } from "./alchemy-visits";
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
type ProgressActivityKind =
  | "battle"
  | "rewards"
  | "destination"
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

const EMPTY_VISITS: Readonly<RunActivityData> = deepFreeze({
  campfire: VISIT_FACTORIES.campfire(),
  transmutation: VISIT_FACTORIES.transmutation(),
  shop: VISIT_FACTORIES.shop(),
  alchemist: VISIT_FACTORIES.alchemist(),
  "trinket-shop": VISIT_FACTORIES["trinket-shop"](),
  "equipment-shop": VISIT_FACTORIES["equipment-shop"](),
  mystery: VISIT_FACTORIES.mystery(),
  corruption: VISIT_FACTORIES.corruption(),
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

const STATELESS_RUN_SCREENS = new Set<ProgressActivityKind>([
  "battle",
  "rewards",
  "destination",
  "labyrinth-map",
  "wildwood-removal",
  "draft-deck",
  "difficulty-select",
]);

export function transitionRunActivity(activity: RunActivity, screen: Screen): RunActivity {
  if (activity.kind === screen) return activity;
  if (Object.hasOwn(VISIT_FACTORIES, screen)) {
    const factory = VISIT_FACTORIES[screen as keyof RunActivityData];
    return { kind: screen as keyof RunActivityData, data: factory() } as RunActivity;
  }
  if (STATELESS_RUN_SCREENS.has(screen as ProgressActivityKind)) {
    return { kind: screen as ProgressActivityKind };
  }
  return activity;
}
