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
    shopState: currentScreen === "shop" ? serializeShopState(session.shopState) : null,
    alchemistState: currentScreen === "alchemist" ? serializeAlchemistState(session.alchemistState) : null,
    trinketShopState: currentScreen === "trinket-shop" ? serializeTrinketShopState(session.trinketShopState) : null,
    equipmentShopState:
      currentScreen === "equipment-shop" ? serializeEquipmentShopState(session.equipmentShopState) : null,
  };
}
