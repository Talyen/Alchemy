import { trinketById, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { playUISound } from "@/lib/audio";
import { GEAR_SLOTS, equipGear, gearDefinitions, type ArmorySlot, type GearInstance, type GearSlot } from "@/lib/gear";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { DisplacedGearItem } from "./armory-ordering";
import type { ArmoryScreenProps } from "./armory-screen-types";
import type { FlyingItem } from "./armory-transfer-overlay";
import { ARMORY_GEAR_SLOT_TESTID, ARMORY_TRINKET_SLOT_TESTID } from "./parts/armory-slot-shell";
import type { useArmoryOrdering } from "./use-armory-ordering";

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

  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [hiddenArtworkIds, setHiddenArtworkIds] = useState<Set<string>>(() => new Set());
  const [hiddenArtworkSlots, setHiddenArtworkSlots] = useState<Partial<Record<ArmorySlot, boolean>>>({});

  const { clearPlaceholder } = ordering;
  const settleActiveTransfers = useCallback(() => {
    setFlyingItems((prev) => (prev.length === 0 ? prev : []));
    setHiddenArtworkIds((prev) => (prev.size === 0 ? prev : new Set()));
    setHiddenArtworkSlots((prev) => (Object.keys(prev).length === 0 ? prev : {}));
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

  const handleSlotUnequip = useCallback(
    (slot: GearSlot) => {
      requireEditable(() => {
        const equippedId = loadout[slot];
        if (!equippedId) return;
        const instance = inventoryById.get(equippedId);
        const definition = instance ? gearDefinitions[instance.definitionId] : undefined;

        settleActiveTransfers();
        (document.activeElement as HTMLElement)?.blur();

        const slotEl = document.querySelector(`[data-testid="${ARMORY_GEAR_SLOT_TESTID}"][data-slot="${slot}"]`);
        const slotRect = slotEl?.getBoundingClientRect();
        const firstTileEl = document.querySelector('[data-testid="armory-inventory-item"]');
        const destRect = firstTileEl?.getBoundingClientRect();

        onUnequip(characterId, slot);
        ordering.commitUnequip(equippedId);

        if (!reducedMotion && slotRect && destRect && definition?.art) {
          setFlyingItems([
            {
              id: `fly-unequip-${equippedId}-${Date.now()}`,
              art: definition.art,
              sourceRect: slotRect,
              destRect,
            },
          ]);
          setHiddenArtworkIds(new Set([equippedId]));
        }
      });
    },
    [requireEditable, loadout, inventoryById, settleActiveTransfers, onUnequip, characterId, ordering, reducedMotion],
  );

  const handleEquipGear = useCallback(
    (instance: GearInstance) => {
      requireEditable(() => {
        if (selectedSlot === "trinket") return;
        settleActiveTransfers();
        (document.activeElement as HTMLElement)?.blur();

        const tileEl = document.querySelector(
          `[data-testid="armory-inventory-item"][data-instance-id="${instance.instanceId}"]`,
        );
        const slotEl = document.querySelector(
          `[data-testid="${ARMORY_GEAR_SLOT_TESTID}"][data-slot="${selectedSlot}"]`,
        );
        const sourceRect = tileEl?.getBoundingClientRect();
        const slotRect = slotEl?.getBoundingClientRect();

        const prevTargetId = loadout[selectedSlot];
        const prevLoadout = { ...loadout };

        const success = onEquip(characterId, selectedSlot, instance);
        if (!success) {
          setNotice("That item cannot be equipped there.");
          playUISound("error");
          return;
        }

        const definition = gearDefinitions[instance.definitionId];
        const prevDefinition = prevTargetId
          ? gearDefinitions[inventoryById.get(prevTargetId)?.definitionId ?? ""]
          : undefined;

        // Check for hand conflicts / displaced items in other slots
        const nextLoadout = equipGear(loadouts, characterId, selectedSlot, instance, sharedInventory)[characterId];
        const additionalDisplaced: DisplacedGearItem[] = [];
        for (const otherSlot of GEAR_SLOTS) {
          if (otherSlot === selectedSlot) continue;
          const otherId = prevLoadout[otherSlot];
          if (otherId && !nextLoadout[otherSlot]) {
            const otherInstance = inventoryById.get(otherId);
            if (otherInstance) {
              additionalDisplaced.push({ slot: otherSlot, instance: otherInstance });
            }
          }
        }

        const newFlying: FlyingItem[] = [];
        const newHiddenIds = new Set<string>();
        const newHiddenSlots: Partial<Record<ArmorySlot, boolean>> = {};

        if (!reducedMotion && sourceRect && slotRect && definition?.art) {
          newFlying.push({
            id: `fly-${instance.instanceId}-${Date.now()}`,
            art: definition.art,
            sourceRect,
            destRect: slotRect,
          });
          newHiddenSlots[selectedSlot] = true;

          if (prevTargetId && prevDefinition?.art) {
            newFlying.push({
              id: `fly-replaced-${prevTargetId}-${Date.now()}`,
              art: prevDefinition.art,
              sourceRect: slotRect,
              destRect: sourceRect,
            });
            newHiddenIds.add(prevTargetId);
            ordering.commitReplacement(instance.instanceId, prevTargetId);
          } else {
            ordering.commitEmptySlotEquip(instance.instanceId);
          }

          if (additionalDisplaced.length > 0) {
            const rightPanelEl = document.querySelector('[data-testid="armory-right-panel"]');
            const rightPanelRect = rightPanelEl?.getBoundingClientRect();

            for (const d of additionalDisplaced) {
              const dDef = gearDefinitions[d.instance.definitionId];
              const dSlotEl = document.querySelector(
                `[data-testid="${ARMORY_GEAR_SLOT_TESTID}"][data-slot="${d.slot}"]`,
              );
              const dSlotRect = dSlotEl?.getBoundingClientRect();

              if (dSlotRect && dDef?.art) {
                newFlying.push({
                  id: `fly-conflict-${d.instance.instanceId}-${Date.now()}`,
                  art: dDef.art,
                  sourceRect: dSlotRect,
                  destRect: rightPanelRect,
                  isFadingOut: true,
                });
                newHiddenSlots[d.slot] = true;
              }
            }
            ordering.commitHandConflicts(instance.instanceId, prevTargetId, additionalDisplaced);
          }
        } else {
          if (additionalDisplaced.length > 0) {
            ordering.commitHandConflicts(instance.instanceId, prevTargetId, additionalDisplaced);
          } else if (prevTargetId) {
            ordering.commitReplacement(instance.instanceId, prevTargetId);
          } else {
            ordering.commitEmptySlotEquip(instance.instanceId);
          }
        }

        if (newFlying.length > 0) {
          setFlyingItems(newFlying);
          setHiddenArtworkIds(newHiddenIds);
          setHiddenArtworkSlots(newHiddenSlots);
        }
      });
    },
    [
      requireEditable,
      selectedSlot,
      settleActiveTransfers,
      loadout,
      loadouts,
      sharedInventory,
      onEquip,
      characterId,
      inventoryById,
      ordering,
      reducedMotion,
      setNotice,
    ],
  );

  const handleEquipTrinket = useCallback(
    (trinketId: string) => {
      requireEditable(() => {
        settleActiveTransfers();
        (document.activeElement as HTMLElement)?.blur();

        const tileEl = document.querySelector(`[data-testid="armory-trinket-item"][data-trinket-id="${trinketId}"]`);
        const slotEl = document.querySelector(`[data-testid="${ARMORY_TRINKET_SLOT_TESTID}"]`);
        const sourceRect = tileEl?.getBoundingClientRect();
        const slotRect = slotEl?.getBoundingClientRect();

        const prevTrinketId = equippedTrinkets[characterId];
        const incomingTrinket = trinketById[trinketId];
        const prevTrinket = prevTrinketId ? trinketById[prevTrinketId] : undefined;

        onEquipTrinket(characterId, trinketId);

        const newFlying: FlyingItem[] = [];
        const newHiddenIds = new Set<string>();
        const newHiddenSlots: Partial<Record<ArmorySlot, boolean>> = {};

        if (!reducedMotion && sourceRect && slotRect && incomingTrinket?.art) {
          newFlying.push({
            id: `fly-trinket-${trinketId}-${Date.now()}`,
            art: incomingTrinket.art,
            sourceRect,
            destRect: slotRect,
            isTrinket: true,
          });
          newHiddenSlots.trinket = true;

          if (prevTrinketId && prevTrinket?.art) {
            newFlying.push({
              id: `fly-replaced-trinket-${prevTrinketId}-${Date.now()}`,
              art: prevTrinket.art,
              sourceRect: slotRect,
              destRect: sourceRect,
              isTrinket: true,
            });
            newHiddenIds.add(prevTrinketId);
            ordering.commitReplacement(trinketId, prevTrinketId);
          } else {
            ordering.commitEmptySlotEquip(trinketId);
          }
        } else {
          if (prevTrinketId) {
            ordering.commitReplacement(trinketId, prevTrinketId);
          } else {
            ordering.commitEmptySlotEquip(trinketId);
          }
        }

        if (newFlying.length > 0) {
          setFlyingItems(newFlying);
          setHiddenArtworkIds(newHiddenIds);
          setHiddenArtworkSlots(newHiddenSlots);
        }
      });
    },
    [requireEditable, settleActiveTransfers, equippedTrinkets, characterId, onEquipTrinket, ordering, reducedMotion],
  );

  const handleUnequipTrinket = useCallback(() => {
    requireEditable(() => {
      const prevTrinketId = equippedTrinkets[characterId];
      if (!prevTrinketId) return;
      const trinket = trinketById[prevTrinketId];

      settleActiveTransfers();
      (document.activeElement as HTMLElement)?.blur();

      const slotEl = document.querySelector(`[data-testid="${ARMORY_TRINKET_SLOT_TESTID}"]`);
      const slotRect = slotEl?.getBoundingClientRect();
      const firstTileEl = document.querySelector('[data-testid="armory-trinket-item"]');
      const destRect = firstTileEl?.getBoundingClientRect();

      onUnequipTrinket(characterId);
      ordering.commitUnequip(prevTrinketId);

      if (!reducedMotion && slotRect && destRect && trinket?.art) {
        setFlyingItems([
          {
            id: `fly-unequip-trinket-${prevTrinketId}-${Date.now()}`,
            art: trinket.art,
            sourceRect: slotRect,
            destRect,
            isTrinket: true,
          },
        ]);
        setHiddenArtworkIds(new Set([prevTrinketId]));
      }
    });
  }, [
    requireEditable,
    equippedTrinkets,
    characterId,
    settleActiveTransfers,
    onUnequipTrinket,
    ordering,
    reducedMotion,
  ]);

  return {
    flyingItems,
    hiddenArtworkIds,
    hiddenArtworkSlots,
    settleActiveTransfers,
    handleSlotUnequip,
    handleEquipGear,
    handleEquipTrinket,
    handleUnequipTrinket,
  };
}
