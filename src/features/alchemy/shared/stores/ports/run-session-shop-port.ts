// Shop session write port — card/alchemist/trinket/equipment shop state.
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "@/lib/active-run-session";
import { getRunTransientStore } from "../run-transient-store";

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  getRunTransientStore().setShopState(state);
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  getRunTransientStore().setAlchemistState(state);
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  getRunTransientStore().setTrinketShopState(state);
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  getRunTransientStore().setEquipmentShopState(state);
}
