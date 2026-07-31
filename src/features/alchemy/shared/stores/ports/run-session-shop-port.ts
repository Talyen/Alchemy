// Shop session write port — card/alchemist/trinket/equipment shop state.
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setShopState(state));
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setAlchemistState(state));
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setTrinketShopState(state));
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  return dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().transient.setEquipmentShopState(state));
}
