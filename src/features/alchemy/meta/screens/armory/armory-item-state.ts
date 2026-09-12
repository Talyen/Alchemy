import { characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import {
  canApplyCraftingCurrency,
  craftingCurrencyBlockedReason,
  getCraftingCurrencyDefinition,
  getGearInstanceTitle,
  type CraftingCurrencyId,
  type GearInstance,
} from "@/lib/gear";

export const COMBAT_LOCKED_MESSAGE = "Equipment cannot be changed during Combat.";

export function reservedReasonFor(reservedBy: CharacterId | null | undefined): string | null {
  if (!reservedBy) return null;
  return `Reserved for ${characters[reservedBy].name} until their battle ends.`;
}

type ArmoryTargetMode = "salvage" | "currency" | null;

export interface ArmoryTargetState {
  canCraft: boolean;
  salvageable: boolean;
  blockedReason: string | null;
  mode: ArmoryTargetMode;
  targetAriaLabel: string | null;
}

export function getArmoryTargetState({
  instance,
  salvageMode,
  activeCurrencyId,
  reservedBy,
}: {
  instance: GearInstance | null | undefined;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  reservedBy?: CharacterId | null | undefined;
}): ArmoryTargetState {
  const reservationReason = reservedReasonFor(reservedBy ?? null);
  if (!instance) {
    return { canCraft: false, salvageable: false, blockedReason: reservationReason, mode: null, targetAriaLabel: null };
  }
  const title = getGearInstanceTitle(instance);
  const canCraft = !reservedBy && activeCurrencyId !== null && canApplyCraftingCurrency(activeCurrencyId, instance);
  const salvageable = !reservedBy && salvageMode;
  const blockedReason =
    reservationReason ?? (activeCurrencyId ? craftingCurrencyBlockedReason(activeCurrencyId, instance) : null);
  const mode: ArmoryTargetMode = salvageable ? "salvage" : canCraft ? "currency" : null;
  let targetAriaLabel: string | null = null;
  if (activeCurrencyId && canCraft) {
    targetAriaLabel = `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${title}`;
  } else if (salvageable) {
    targetAriaLabel = `Salvage ${title}`;
  }
  return { canCraft, salvageable, blockedReason, mode, targetAriaLabel };
}

export function formatTrinketEquipAriaLabel(title: string, equippedBy: CharacterId | null | undefined): string {
  return `Equip ${title}${equippedBy ? ` from ${equippedBy}` : ""}`;
}

type ArmoryItemAction =
  | "none"
  | "combat-locked"
  | "salvage"
  | "craft"
  | "incompatible"
  | "equip"
  | "unequip"
  | "select";

type ArmoryItemSurface = { kind: "inventory"; loadoutLegal: boolean } | { kind: "equipment"; selected: boolean };

/** Shared click policy; equipped slots additionally allow browsing while locked. */
export function getArmoryItemInteraction(
  input: Parameters<typeof getArmoryTargetState>[0] & {
    editable: boolean;
    surface: ArmoryItemSurface;
  },
) {
  const { instance, editable, surface, salvageMode, activeCurrencyId, reservedBy } = input;
  const targeting = getArmoryTargetState(input);
  function action(): ArmoryItemAction {
    if (reservedBy) return "none";
    if (!editable) {
      if (surface.kind === "inventory") return "combat-locked";
      return instance && (surface.selected || salvageMode || activeCurrencyId) ? "combat-locked" : "select";
    }
    if (salvageMode) return instance ? "salvage" : "none";
    if (activeCurrencyId && instance) return "craft";
    if (surface.kind === "inventory") return surface.loadoutLegal ? "equip" : "incompatible";
    return surface.selected && instance ? "unequip" : "select";
  }
  const itemAction = action();
  const incompatible =
    surface.kind === "inventory" && editable && !salvageMode && !activeCurrencyId && !surface.loadoutLegal;
  return {
    ...targeting,
    action: itemAction,
    incompatible,
    ariaDisabled: !editable || Boolean(reservedBy) || incompatible,
  };
}

export function performArmoryItemAction(
  action: ArmoryItemAction,
  handlers: Partial<Record<ArmoryItemAction, () => void>>,
) {
  handlers[action]?.();
}
