import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";

export type ArmoryCursorPoint = { x: number; y: number };

export type TransferMenuState = {
  instanceId: string;
  sourceCharacterId: CharacterId;
  anchor: { x: number; y: number };
} | null;

export type ArmoryTargetingState = {
  salvageMode: boolean;
  salvageTarget: GearInstance | null;
  activeCurrencyId: CraftingCurrencyId | null;
  cursorPoint: ArmoryCursorPoint | null;
  transferMenu: TransferMenuState;
};

export const initialArmoryTargetingState: ArmoryTargetingState = {
  salvageMode: false,
  salvageTarget: null,
  activeCurrencyId: null,
  cursorPoint: null,
  transferMenu: null,
};

export type ArmoryTargetingAction =
  | { type: "TOGGLE_SALVAGE_MODE" }
  | { type: "DESELECT_SALVAGE_MODE" }
  | { type: "START_SALVAGE_TARGET"; target: GearInstance }
  | { type: "CLEAR_SALVAGE_TARGET" }
  | { type: "SALVAGE_TARGET_GONE" }
  | { type: "SELECT_CURRENCY"; currencyId: CraftingCurrencyId }
  | { type: "DESELECT_CURRENCY" }
  | { type: "TOGGLE_CURRENCY"; currencyId: CraftingCurrencyId }
  | { type: "CURRENCY_DEPLETED" }
  | { type: "SET_CURSOR"; point: ArmoryCursorPoint | null }
  | { type: "CLEAR_TARGETING" }
  | { type: "EDITABLE_LOST" }
  | { type: "SELECT_CHARACTER" }
  | { type: "OPEN_TRANSFER_MENU"; instanceId: string; sourceCharacterId: CharacterId; anchor: { x: number; y: number } }
  | { type: "CLOSE_TRANSFER_MENU" };

export function armoryTargetingReducer(
  state: ArmoryTargetingState,
  action: ArmoryTargetingAction,
): ArmoryTargetingState {
  switch (action.type) {
    case "TOGGLE_SALVAGE_MODE":
      return { ...state, salvageMode: !state.salvageMode, activeCurrencyId: null };
    case "DESELECT_SALVAGE_MODE":
      if (!state.salvageMode) return state;
      return { ...state, salvageMode: false };
    case "START_SALVAGE_TARGET":
      return { ...state, salvageTarget: action.target };
    case "CLEAR_SALVAGE_TARGET":
      if (state.salvageTarget === null) return state;
      return { ...state, salvageTarget: null };
    case "SALVAGE_TARGET_GONE":
      if (state.salvageTarget === null) return state;
      return { ...state, salvageTarget: null };
    case "SELECT_CURRENCY":
      return { ...state, activeCurrencyId: action.currencyId, salvageMode: false };
    case "DESELECT_CURRENCY":
      if (state.activeCurrencyId === null) return state;
      return { ...state, activeCurrencyId: null };
    case "TOGGLE_CURRENCY":
      return state.activeCurrencyId === action.currencyId
        ? { ...state, activeCurrencyId: null }
        : { ...state, activeCurrencyId: action.currencyId, salvageMode: false };
    case "CURRENCY_DEPLETED":
      if (state.activeCurrencyId === null) return state;
      return { ...state, activeCurrencyId: null };
    case "SET_CURSOR":
      if (
        state.cursorPoint === action.point ||
        (state.cursorPoint !== null &&
          action.point !== null &&
          state.cursorPoint.x === action.point.x &&
          state.cursorPoint.y === action.point.y)
      ) {
        return state;
      }
      return { ...state, cursorPoint: action.point };
    case "CLEAR_TARGETING":
      if (!state.salvageMode && state.activeCurrencyId === null && state.cursorPoint === null) {
        return state;
      }
      return { ...state, salvageMode: false, activeCurrencyId: null, cursorPoint: null };
    case "EDITABLE_LOST":
      if (
        !state.salvageMode &&
        state.activeCurrencyId === null &&
        state.cursorPoint === null &&
        state.salvageTarget === null
      ) {
        return state;
      }
      return { ...state, salvageMode: false, activeCurrencyId: null, cursorPoint: null, salvageTarget: null };
    case "SELECT_CHARACTER":
      return { ...state, salvageMode: false, activeCurrencyId: null, cursorPoint: null, salvageTarget: null };
    case "OPEN_TRANSFER_MENU":
      return {
        ...state,
        transferMenu: {
          instanceId: action.instanceId,
          sourceCharacterId: action.sourceCharacterId,
          anchor: action.anchor,
        },
      };
    case "CLOSE_TRANSFER_MENU":
      if (state.transferMenu === null) return state;
      return { ...state, transferMenu: null };
  }
}
