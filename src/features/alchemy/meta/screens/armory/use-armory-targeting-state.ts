import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import { useCallback, useEffect, useState } from "react";
import type { ArmorySalvagePending } from "./armory-screen-types";
import { useArmoryTargetingEvents } from "./use-armory-targeting-events";

type TargetingState =
  | { kind: "idle" }
  | { kind: "salvage" }
  | { kind: "currency"; currencyId: CraftingCurrencyId }
  | { kind: "confirm-salvage"; pending: ArmorySalvagePending };

const IDLE: TargetingState = { kind: "idle" };

export function useArmoryTargetingState({
  editable,
  craftingCurrencies,
  characterId,
  inventoryById,
}: {
  editable: boolean;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
}) {
  const [targeting, setTargeting] = useState<TargetingState>(IDLE);
  const salvageMode = targeting.kind === "salvage";
  const activeCurrencyId = targeting.kind === "currency" ? targeting.currencyId : null;
  const salvagePending = targeting.kind === "confirm-salvage" ? targeting.pending : null;
  const clearTargeting = useCallback(() => setTargeting(IDLE), []);
  const toggleSalvage = useCallback(() => {
    if (editable) setTargeting((current) => (current.kind === "salvage" ? IDLE : { kind: "salvage" }));
  }, [editable]);
  const selectCurrency = useCallback(
    (currencyId: CraftingCurrencyId) => {
      if (!editable || craftingCurrencies[currencyId] <= 0) return;
      setTargeting((current) =>
        current.kind === "currency" && current.currencyId === currencyId ? IDLE : { kind: "currency", currencyId },
      );
    },
    [editable, craftingCurrencies],
  );
  const confirmSalvage = useCallback(
    (pending: ArmorySalvagePending) => {
      if (editable) setTargeting({ kind: "confirm-salvage", pending });
    },
    [editable],
  );

  // Reset invalid selections before committing a render, so replenishment cannot re-arm them.
  if (
    targeting.kind !== "idle" &&
    (!editable ||
      (activeCurrencyId !== null && craftingCurrencies[activeCurrencyId] <= 0) ||
      (salvagePending !== null && !inventoryById.has(salvagePending.instance.instanceId)))
  ) {
    setTargeting(IDLE);
  }

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [editable, characterId]);

  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget: salvagePending?.instance ?? null,
    clearTargeting,
  });

  return {
    salvageMode,
    activeCurrencyId,
    salvagePending,
    clearTargeting,
    toggleSalvage,
    selectCurrency,
    confirmSalvage,
  };
}
