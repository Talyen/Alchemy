// Shop session write port — card/alchemist/trinket/equipment shop state.
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "@/lib/active-run-session";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setShopState(state));
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setAlchemistState(state));
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setTrinketShopState(state));
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setEquipmentShopState(state));
}
