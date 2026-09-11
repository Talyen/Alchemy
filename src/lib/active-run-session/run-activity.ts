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
export type RunActivity = { kind: "idle" | ProgressActivityKind } | VisitActivity;

const EMPTY_VISITS: RunActivityData = {
  shop: emptyShopState(),
  alchemist: emptyAlchemistState(),
  "trinket-shop": emptyTrinketShopState(),
  "equipment-shop": emptyEquipmentShopState(),
  mystery: emptyHydratedMysteryVisit(),
  corruption: null,
};

export function readActivityData<K extends keyof RunActivityData>(activity: RunActivity, kind: K): RunActivityData[K] {
  return activity.kind === kind && "data" in activity ? (activity.data as RunActivityData[K]) : EMPTY_VISITS[kind];
}

export function runActivityScreen(activity: RunActivity): Screen | null {
  return activity.kind === "idle" ? null : activity.kind;
}

export function transitionRunActivity(activity: RunActivity, screen: Screen): RunActivity {
  if (activity.kind === screen) return activity;
  switch (screen) {
    case "shop":
      return { kind: screen, data: emptyShopState() };
    case "alchemist":
      return { kind: screen, data: emptyAlchemistState() };
    case "trinket-shop":
      return { kind: screen, data: emptyTrinketShopState() };
    case "equipment-shop":
      return { kind: screen, data: emptyEquipmentShopState() };
    case "mystery":
      return { kind: screen, data: emptyHydratedMysteryVisit() };
    case "corruption":
      return { kind: screen, data: null };
    case "battle":
    case "rewards":
    case "destination":
    case "campfire":
    case "labyrinth-map":
    case "wildwood-removal":
    case "draft-deck":
    case "difficulty-select":
      return { kind: screen };
    case "menu":
    case "game-mode-select":
    case "character-select":
    case "options":
    case "collection":
    case "talents":
    case "homestead":
    case "armory":
    case "game-over":
    case "run-victory":
      return activity;
  }
}
