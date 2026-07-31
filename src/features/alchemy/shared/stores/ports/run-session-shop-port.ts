// Shop session write port — card/alchemist/trinket/equipment shop state.
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "@/lib/active-run-session";
import { getRunTransientStore } from "../run-transient-store";
import { dispatchRunSessionCommand } from "../run-session-command";

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setShopState(state));
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setAlchemistState(state));
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setTrinketShopState(state));
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  return dispatchRunSessionCommand(() => getRunTransientStore().setEquipmentShopState(state));
}
