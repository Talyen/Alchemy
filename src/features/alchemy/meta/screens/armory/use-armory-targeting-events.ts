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

function testIdSelectors(...ids: string[]): string {
  return ids.map((id) => `[data-testid="${id}"]`).join(",");
}

const WORKSPACE = testIdSelectors("armory-workspace");
const CONTEXT_MENU_REGIONS = testIdSelectors(
  "armory-crafting-currency",
  "armory-inventory-item",
  "armory-trinket-item",
  "armory-equipment-slot",
  "armory-trinket-slot",
);
const CURRENCY_CLICK_REGIONS = [
  CONTEXT_MENU_REGIONS,
  WORKSPACE,
  testIdSelectors("confirmation-dialog", "armory-crafting-strip", "armory-salvage-toggle"),
].join(",");
const SALVAGE_CLICK_REGIONS = [
  '[data-salvageable="true"]',
  testIdSelectors("armory-salvage-toggle", "armory-crafting-strip"),
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
    if (target?.closest(WORKSPACE)) event.preventDefault();
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
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  document.addEventListener("click", handleClick, options);
  document.addEventListener("contextmenu", handleContextMenu, options);
  window.addEventListener("blur", clearTargeting, options);
  document.addEventListener("visibilitychange", handleVisibilityChange, options);
  return () => {
    unsubscribeEscape();
    lifetime.abort();
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
