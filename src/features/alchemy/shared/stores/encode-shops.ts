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

interface PersistedShops {
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
}

const EMPTY_PERSISTED_SHOPS: PersistedShops = {
  shopState: null,
  alchemistState: null,
  trinketShopState: null,
  equipmentShopState: null,
};

const SHOP_ENCODERS: Partial<Record<Screen, (session: RunSession["session"]) => PersistedShops>> = {
  shop: (session) => ({ ...EMPTY_PERSISTED_SHOPS, shopState: serializeShopState(session.shopState) }),
  alchemist: (session) => ({
    ...EMPTY_PERSISTED_SHOPS,
    alchemistState: serializeAlchemistState(session.alchemistState),
  }),
  "trinket-shop": (session) => ({
    ...EMPTY_PERSISTED_SHOPS,
    trinketShopState: serializeTrinketShopState(session.trinketShopState),
  }),
  "equipment-shop": (session) => ({
    ...EMPTY_PERSISTED_SHOPS,
    equipmentShopState: serializeEquipmentShopState(session.equipmentShopState),
  }),
};

export function encodePersistedShops(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): PersistedShops {
  const encode = currentScreen ? SHOP_ENCODERS[currentScreen] : undefined;
  return encode ? encode(session) : EMPTY_PERSISTED_SHOPS;
}
