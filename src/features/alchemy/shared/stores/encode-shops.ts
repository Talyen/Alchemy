import {
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeShopState,
  serializeTrinketShopState,
  type PersistedAlchemistState,
  type PersistedEquipmentShopState,
  type PersistedShopState,
  type PersistedTrinketShopState,
} from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { RunSession } from "./run-session-model";

export function encodePersistedShops(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): {
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
} {
  return {
    shopState:
      currentScreen === "shop" || session.shopState.cards.length > 0 ? serializeShopState(session.shopState) : null,
    alchemistState:
      currentScreen === "alchemist" || session.alchemistState.potions.length > 0
        ? serializeAlchemistState(session.alchemistState)
        : null,
    trinketShopState:
      currentScreen === "trinket-shop" || session.trinketShopState.trinkets.length > 0
        ? serializeTrinketShopState(session.trinketShopState)
        : null,
    equipmentShopState:
      currentScreen === "equipment-shop" || session.equipmentShopState.gear.length > 0
        ? serializeEquipmentShopState(session.equipmentShopState)
        : null,
  };
}
