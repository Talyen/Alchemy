import { useEffect } from "react";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";

type UseArmoryTargetingEventsOptions = {
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  salvageTarget: GearInstance | null;
  clearTargeting: () => void;
};

export function useArmoryTargetingEvents({
  salvageMode,
  activeCurrencyId,
  salvageTarget,
  clearTargeting,
}: UseArmoryTargetingEventsOptions) {
  useEffect(() => {
    if (!salvageMode && !activeCurrencyId) return;
    if (salvageTarget) return;

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      clearTargeting();
      event.preventDefault();
      event.stopPropagation();
    }

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
      if (event.target instanceof HTMLElement && event.target.closest('[data-testid="armory-crafting-currency"]')) {
        return;
      }
      event.preventDefault();
      clearTargeting();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activeCurrencyId, clearTargeting, salvageMode, salvageTarget]);
}
