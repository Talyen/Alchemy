import { trinketById, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { playUISound } from "@/lib/audio";
import { GEAR_SLOTS, equipGear, gearDefinitions, type ArmorySlot, type GearInstance, type GearSlot } from "@/lib/gear";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArmoryScreenProps } from "./armory-screen-types";
import type { useArmoryOrdering } from "./use-armory-ordering";
import { blurArmoryFocus, measureArmoryItem, measureArmoryPanel, measureArmorySlot } from "./armory-transfer-dom";
import {
  buildEquipFlights,
  buildUnequipFlights,
  hiddenTransferArtwork,
  type ArmoryFlight,
  type TransferArtwork,
} from "./armory-transfer-presentation";

type TransferProps = Pick<
  ArmoryScreenProps,
  "loadouts" | "equippedTrinkets" | "onEquip" | "onUnequip" | "onEquipTrinket" | "onUnequipTrinket"
> & {
  characterId: CharacterId;
  selectedSlot: ArmorySlot;
  inventoryById: Map<string, GearInstance>;
  sharedInventory: GearInstance[];
  ordering: ReturnType<typeof useArmoryOrdering>;
  requireEditable: (action: () => void) => void;
  setNotice: (notice: string) => void;
};

export function useArmoryTransfers({
  loadouts,
  equippedTrinkets,
  onEquip,
  onUnequip,
  onEquipTrinket,
  onUnequipTrinket,
  characterId,
  selectedSlot,
  inventoryById,
  sharedInventory,
  ordering,
  requireEditable,
  setNotice,
}: TransferProps) {
  const loadout = loadouts[characterId];
  const reducedMotion = useReducedMotion();

  const [flyingItems, setFlyingItems] = useState<ArmoryFlight[]>([]);
  const transferSequence = useRef(0);
  const { clearPlaceholder, commitEquip, commitUnequip } = ordering;
  const settleActiveTransfers = useCallback(() => {
    setFlyingItems((prev) => (prev.length === 0 ? prev : []));
    clearPlaceholder();
  }, [clearPlaceholder]);

  useEffect(() => {
    window.addEventListener("resize", settleActiveTransfers);
    window.addEventListener("scroll", settleActiveTransfers, true);
    return () => {
      window.removeEventListener("resize", settleActiveTransfers);
      window.removeEventListener("scroll", settleActiveTransfers, true);
    };
  }, [settleActiveTransfers]);

  function beginTransfer() {
    settleActiveTransfers();
    blurArmoryFocus();
  }

  function present(flights: ArmoryFlight[]) {
    if (reducedMotion || flights.length === 0) {
      clearPlaceholder();
      return;
    }
    const sequence = ++transferSequence.current;
    setFlyingItems(flights.map((flight) => ({ ...flight, id: `${sequence}-${flight.id}` })));
  }

  function gearArtwork(id: string): TransferArtwork {
    const instance = inventoryById.get(id);
    return { id, art: instance ? gearDefinitions[instance.definitionId]?.art : undefined };
  }

  function trinketArtwork(id: string): TransferArtwork {
    return { id, art: trinketById[id]?.art, isTrinket: true };
  }

  function handleEquipGear(instance: GearInstance) {
    requireEditable(() => {
      if (selectedSlot === "trinket") return;
      beginTransfer();
      const sourceRect = measureArmoryItem(false, instance.instanceId);
      const slotRect = measureArmorySlot(selectedSlot);
      const replacedId = loadout[selectedSlot];
      // Reuse the domain rule to describe all displaced slots; do not duplicate hand rules.
      const nextLoadout = equipGear(loadouts, characterId, selectedSlot, instance, sharedInventory)[characterId];
      const displaced = GEAR_SLOTS.flatMap((slot) => {
        const previousId = loadout[slot];
        const previous = previousId ? inventoryById.get(previousId) : undefined;
        return slot !== selectedSlot && previous && !nextLoadout[slot] ? [{ slot, instance: previous }] : [];
      });
      const flights = buildEquipFlights({
        incoming: gearArtwork(instance.instanceId),
        replaced: replacedId ? gearArtwork(replacedId) : undefined,
        slot: selectedSlot,
        sourceRect,
        slotRect,
        displaced: displaced.map(({ slot, instance: item }) => ({
          slot,
          artwork: gearArtwork(item.instanceId),
          rect: measureArmorySlot(slot),
        })),
        panelRect: measureArmoryPanel(),
      });
      if (!onEquip(characterId, selectedSlot, instance)) {
        setNotice("That item cannot be equipped there.");
        playUISound("error");
        return;
      }
      commitEquip(instance.instanceId, replacedId, displaced);
      present(flights);
    });
  }

  function handleEquipTrinket(trinketId: string) {
    requireEditable(() => {
      beginTransfer();
      const replacedId = equippedTrinkets[characterId];
      const flights = buildEquipFlights({
        incoming: trinketArtwork(trinketId),
        replaced: replacedId ? trinketArtwork(replacedId) : undefined,
        slot: "trinket",
        sourceRect: measureArmoryItem(true, trinketId),
        slotRect: measureArmorySlot("trinket"),
        displaced: [],
        panelRect: undefined,
      });
      onEquipTrinket(characterId, trinketId);
      commitEquip(trinketId, replacedId);
      present(flights);
    });
  }

  function unequip(slot: ArmorySlot, artwork: TransferArtwork, commit: () => void) {
    beginTransfer();
    const flights = buildUnequipFlights(artwork, measureArmorySlot(slot), measureArmoryItem(slot === "trinket"));
    commit();
    commitUnequip(artwork.id);
    present(flights);
  }

  function handleSlotUnequip(slot: GearSlot) {
    requireEditable(() => {
      const id = loadout[slot];
      if (id) unequip(slot, gearArtwork(id), () => onUnequip(characterId, slot));
    });
  }

  function handleUnequipTrinket() {
    requireEditable(() => {
      const id = equippedTrinkets[characterId];
      if (id) unequip("trinket", trinketArtwork(id), () => onUnequipTrinket(characterId));
    });
  }

  return {
    flyingItems,
    ...hiddenTransferArtwork(flyingItems),
    settleActiveTransfers,
    handleSlotUnequip,
    handleEquipGear,
    handleEquipTrinket,
    handleUnequipTrinket,
  };
}
