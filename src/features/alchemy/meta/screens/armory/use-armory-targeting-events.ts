import { useEffect } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import { useLatestRef } from "../../../shared/ui/use-latest-ref";

interface UseArmoryTargetingEventsOptions {
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageTarget: GearInstance | null;
  clearTargeting: () => void;
}

const ARMORY_TARGETING_SELECTORS = {
  workspace: '[data-testid="armory-workspace"]',
  inventoryItem: '[data-testid="armory-inventory-item"]',
  equipmentSlot: '[data-testid="armory-equipment-slot"]',
  trinketSlot: '[data-testid="armory-trinket-slot"]',
  trinketItem: '[data-testid="armory-trinket-item"]',
  craftingCurrency: '[data-testid="armory-crafting-currency"]',
  craftingStrip: '[data-testid="armory-crafting-strip"]',
  salvageToggle: '[data-testid="armory-salvage-toggle"]',
  confirmationDialog: '[data-testid="confirmation-dialog"]',
  salvageable: '[data-salvageable="true"]',
} as const;

const CURRENCY_CLICK_REGIONS = [
  ARMORY_TARGETING_SELECTORS.workspace,
  ARMORY_TARGETING_SELECTORS.confirmationDialog,
  ARMORY_TARGETING_SELECTORS.inventoryItem,
  ARMORY_TARGETING_SELECTORS.equipmentSlot,
  ARMORY_TARGETING_SELECTORS.trinketSlot,
  ARMORY_TARGETING_SELECTORS.trinketItem,
  ARMORY_TARGETING_SELECTORS.craftingCurrency,
  ARMORY_TARGETING_SELECTORS.craftingStrip,
  ARMORY_TARGETING_SELECTORS.salvageToggle,
].join(",");

const SALVAGE_CLICK_REGIONS = [
  ARMORY_TARGETING_SELECTORS.salvageable,
  ARMORY_TARGETING_SELECTORS.salvageToggle,
  ARMORY_TARGETING_SELECTORS.craftingStrip,
].join(",");

const CONTEXT_MENU_REGIONS = [
  ARMORY_TARGETING_SELECTORS.craftingCurrency,
  ARMORY_TARGETING_SELECTORS.inventoryItem,
  ARMORY_TARGETING_SELECTORS.trinketItem,
  ARMORY_TARGETING_SELECTORS.equipmentSlot,
  ARMORY_TARGETING_SELECTORS.trinketSlot,
].join(",");

function setupTargetingEventListeners(salvageMode: boolean, clearTargeting: () => void): () => void {
  function handleClick(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(salvageMode ? SALVAGE_CLICK_REGIONS : CURRENCY_CLICK_REGIONS)) return;
    clearTargeting();
  }

  function handleContextMenu(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(CONTEXT_MENU_REGIONS)) return;
    if (target?.closest(ARMORY_TARGETING_SELECTORS.workspace)) event.preventDefault();
    clearTargeting();
  }

  function handleBlur() {
    clearTargeting();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") clearTargeting();
  }

  const unsubscribeEscape = pushEscapeHandler({
    id: "armory-targeting",
    priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT,
    onEscape: () => clearTargeting(),
  });
  document.addEventListener("click", handleClick);
  document.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("blur", handleBlur);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => {
    unsubscribeEscape();
    document.removeEventListener("click", handleClick);
    document.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export function useArmoryTargetingEvents({
  salvageMode,
  activeCurrencyId,
  salvageTarget,
  clearTargeting,
}: UseArmoryTargetingEventsOptions) {
  const clearTargetingRef = useLatestRef(clearTargeting);

  useEffect(() => {
    if (!salvageMode && !activeCurrencyId) return;
    if (salvageTarget) return;
    return setupTargetingEventListeners(salvageMode, () => clearTargetingRef.current());
  }, [activeCurrencyId, clearTargetingRef, salvageMode, salvageTarget]);
}
