import { useEffect, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";

interface UseArmoryTargetingEventsOptions {
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageTarget: GearInstance | null;
  clearTargeting: () => void;
}

function isTargetingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    !!target.closest('[data-testid="armory-workspace"]') ||
    !!target.closest('[data-testid="confirmation-dialog"]') ||
    !!target.closest('[data-testid="armory-inventory-item"]') ||
    !!target.closest('[data-testid="armory-equipment-slot"]') ||
    !!target.closest('[data-testid="armory-crafting-currency"]') ||
    !!target.closest(".armory-salvage-tile") ||
    !!target.closest('[data-testid="armory-salvage-toggle"]')
  );
}

function setupTargetingEventListeners(salvageMode: boolean, clearTargeting: () => void): () => void {
  function handleClick(event: MouseEvent) {
    if (salvageMode) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('[data-salvageable="true"]') ||
          event.target.closest('[data-testid="armory-salvage-toggle"]'))
      ) {
        return;
      }
      clearTargeting();
      return;
    }
    if (isTargetingElement(event.target)) return;
    clearTargeting();
  }

  function handleContextMenu(event: MouseEvent) {
    if (
      event.target instanceof HTMLElement &&
      (event.target.closest('[data-testid="armory-crafting-currency"]') ||
        event.target.closest('[data-testid="armory-inventory-item"]') ||
        event.target.closest('[data-testid="armory-equipment-slot"]'))
    ) {
      return;
    }
    event.preventDefault();
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
  const clearTargetingRef = useRef(clearTargeting);
  useEffect(() => {
    clearTargetingRef.current = clearTargeting;
  });

  useEffect(() => {
    if (!salvageMode && !activeCurrencyId) return;
    if (salvageTarget) return;
    return setupTargetingEventListeners(salvageMode, () => clearTargetingRef.current());
  }, [activeCurrencyId, salvageMode, salvageTarget]);
}
