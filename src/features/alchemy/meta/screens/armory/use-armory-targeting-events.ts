import { useEffect } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import { useLatestRef } from "../../../shared/hooks";

interface UseArmoryTargetingEventsOptions {
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageTarget: GearInstance | null;
  clearTargeting: () => void;
}

const CURRENCY_CLICK_REGIONS = [
  '[data-testid="armory-workspace"]',
  '[data-testid="confirmation-dialog"]',
  '[data-testid="armory-inventory-item"]',
  '[data-testid="armory-equipment-slot"]',
  '[data-testid="armory-trinket-slot"]',
  '[data-testid="armory-trinket-item"]',
  '[data-testid="armory-crafting-currency"]',
  '[data-testid="armory-crafting-strip"]',
  '[data-testid="armory-salvage-toggle"]',
].join(",");

const SALVAGE_CLICK_REGIONS = [
  '[data-salvageable="true"]',
  '[data-testid="armory-salvage-toggle"]',
  '[data-testid="armory-crafting-strip"]',
].join(",");

const CONTEXT_MENU_REGIONS = [
  '[data-testid="armory-crafting-currency"]',
  '[data-testid="armory-inventory-item"]',
  '[data-testid="armory-trinket-item"]',
  '[data-testid="armory-equipment-slot"]',
  '[data-testid="armory-trinket-slot"]',
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
    if (target?.closest('[data-testid="armory-workspace"]')) event.preventDefault();
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
