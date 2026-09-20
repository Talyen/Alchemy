import { ArmoryEquipmentPanel } from "./armory/armory-equipment-panel";
import { screenShellPaddingClass } from "@/features/alchemy/shared/config";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  trinketById,
  trinketLibrary,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { playUISound } from "@/lib/audio";
import {
  EMPTY_CRAFTING_CURRENCIES,
  GEAR_SLOTS,
  computeSalvageYield,
  craftingCurrencyBlockedReason,
  equipGear,
  findGearEquippedCharacter,
  flattenGearInventories,
  gearDefinitions,
  getGearInstanceTitle,
  type ArmorySlot,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageLayout, ScreenHeaderRow } from "../../shared/ui/layout-components";
import { FadeSlot } from "../../shared/ui/use-fade";
import { ArmoryCharacterTabs, ArmoryOverlays, type ArmoryScreenProps } from "./armory";
import { ArmoryFeedback } from "./armory/armory-feedback";
import { COMBAT_LOCKED_MESSAGE } from "./armory/armory-item-state";
import { ArmoryPickerPanel } from "./armory/armory-picker-panel";
import { applyCurrencyToGear, itemsMatchingSlot } from "./armory/armory-screen-actions";
import { ArmoryTransferOverlay, type FlyingItem } from "./armory/armory-transfer-overlay";
import { useArmoryOrdering } from "./armory/use-armory-ordering";
import type { ArmorySortOption, DisplacedGearItem } from "./armory/armory-ordering";
import { ARMORY_GEAR_SLOT_TESTID, ARMORY_TRINKET_SLOT_TESTID } from "./armory/parts/armory-slot-shell";
import "./armory/armory-screen.css";
import type { CraftingResult } from "./armory/crafting-result";
import { useArmoryTargetingState } from "./armory/use-armory-targeting-state";

export function ArmoryScreen({
  inventories,
  loadouts,
  ownedTrinketIds,
  equippedTrinkets,
  craftingCurrencies = EMPTY_CRAFTING_CURRENCIES,
  finishedRunCharacters,
  combatRestrictions,
  onEquip,
  onUnequip,
  onEquipTrinket,
  onUnequipTrinket,
  onSalvage,
  onApplyCurrency = () => false,
  onSpawnDevGear,
  onBack,
  onMenu,
}: ArmoryScreenProps) {
  const salvageButtonRef = useRef<HTMLButtonElement>(null);
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [selectedSlot, setSelectedSlot] = useState<ArmorySlot>("main-hand");
  const [craftingResult, setCraftingResult] = useState<CraftingResult | null>(null);
  const [notice, setNotice] = useState("");
  const sharedInventory = useMemo(() => flattenGearInventories(inventories), [inventories]);
  const inventoryById = useMemo(
    () => new Map(sharedInventory.map((item) => [item.instanceId, item])),
    [sharedInventory],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
  const browseOnly = Boolean(combatRestrictions.characters[characterId]?.length);
  const editable = !browseOnly && !locked;
  const pickerItems = useMemo(() => {
    if (selectedSlot === "trinket") return [];
    const equippedId = loadout[selectedSlot];
    return itemsMatchingSlot(sharedInventory, selectedSlot).filter((item) => item.instanceId !== equippedId);
  }, [sharedInventory, loadout, selectedSlot]);
  const ownedTrinkets = useMemo(() => {
    const owned = new Set(ownedTrinketIds);
    const equippedId = equippedTrinkets[characterId];
    return trinketLibrary.filter((entry) => owned.has(entry.id) && entry.id !== equippedId);
  }, [ownedTrinketIds, equippedTrinkets, characterId]);
  const equippedTrinketId = equippedTrinkets[characterId];
  const equippedTrinket = equippedTrinketId ? trinketById[equippedTrinketId] : undefined;

  const ordering = useArmoryOrdering({
    characterId,
    selectedSlot,
    pickerItems,
    ownedTrinkets,
  });

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

  const {
    salvageMode,
    toggleSalvage,
    activeCurrencyId,
    selectCurrency,
    salvagePending,
    confirmSalvage,
    clearTargeting,
  } = useArmoryTargetingState({ editable, craftingCurrencies, characterId, inventoryById });

  const handleSelectCharacter = useCallback(
    (id: CharacterId) => {
      settleActiveTransfers();
      setCharacterId(id);
      setCraftingResult(null);
      setNotice("");
      clearTargeting();
    },
    [clearTargeting, settleActiveTransfers],
  );

  const handleCombatLockedAttempt = useCallback(() => {
    if (!browseOnly) return;
    setNotice(COMBAT_LOCKED_MESSAGE);
    playUISound("error");
  }, [browseOnly]);

  const requireEditable = useCallback(
    (action: () => void) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
      action();
    },
    [editable, handleCombatLockedAttempt],
  );

  function handleSelectCurrency(currencyId: CraftingCurrencyId) {
    requireEditable(() => {
      if (craftingCurrencies[currencyId] <= 0) return;
      selectCurrency(currencyId);
      setCraftingResult(null);
      setNotice("");
    });
  }

  const beginSalvage = useCallback(
    (instance: GearInstance) => {
      requireEditable(() => {
        if (combatRestrictions.gear[instance.instanceId]) return;
        setNotice("");
        setCraftingResult(null);
        confirmSalvage({ instance, yield: computeSalvageYield(instance) });
      });
    },
    [combatRestrictions.gear, confirmSalvage, requireEditable],
  );

  const handleApplyCurrency = useCallback(
    (instance: GearInstance) => {
      requireEditable(() => {
        if (!activeCurrencyId || combatRestrictions.gear[instance.instanceId]) return;
        const reason = craftingCurrencyBlockedReason(activeCurrencyId, instance);
        if (reason) {
          setNotice(reason);
          playUISound("error");
          return;
        }
        const applied = applyCurrencyToGear({
          editable,
          activeCurrencyId,
          instance,
          onApplyCurrency,
          clearCurrency: clearTargeting,
        });
        if (applied) {
          setNotice("");
          setCraftingResult({ before: instance, currencyId: activeCurrencyId });
        } else setNotice("Crafting could not be completed. No currency was spent.");
      });
    },
    [activeCurrencyId, combatRestrictions.gear, requireEditable, editable, onApplyCurrency, clearTargeting],
  );

  const handleSlotSelect = useCallback(
    (slot: ArmorySlot) => {
      settleActiveTransfers();
      setSelectedSlot(slot);
      if (slot === "trinket") clearTargeting();
    },
    [clearTargeting, settleActiveTransfers],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      settleActiveTransfers();
      ordering.setPage(page);
    },
    [ordering, settleActiveTransfers],
  );

  const handleSort = useCallback(
    (option: ArmorySortOption) => {
      settleActiveTransfers();
      ordering.onSort(option);
    },
    [ordering, settleActiveTransfers],
  );

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

  const equippedSalvageCharacter = salvagePending
    ? findGearEquippedCharacter(loadouts, salvagePending.instance.instanceId)
    : null;
  const craftedItem = craftingResult ? inventoryById.get(craftingResult.before.instanceId) : undefined;

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

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "my-auto flex w-full max-w-[1536px] flex-1 flex-col pb-1",
          screenShellPaddingClass,
          salvageMode && "armory-salvage-cursor",
        )}
      >
        <ScreenHeaderRow className="min-h-10 px-12" title="Armory" onBack={onBack} onMenu={onMenu} />
        <ArmoryCharacterTabs
          activeTab={characterId}
          finishedRunCharacters={finishedRunCharacters}
          onSelectTab={handleSelectCharacter}
        />
        <div
          className="armory-workspace mt-2 min-h-0 min-w-0 flex-1"
          data-testid="armory-workspace"
          inert={salvagePending !== null}
        >
          <FadeSlot swapKey={characterId} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="armory-workspace-grid">
              <ArmoryEquipmentPanel
                loadout={loadout}
                inventoryById={inventoryById}
                equippedTrinket={equippedTrinket}
                selectedSlot={selectedSlot}
                targeting={{ editable, salvageMode, activeCurrencyId, craftingResult }}
                hiddenArtworkSlots={hiddenArtworkSlots}
                salvageButtonRef={salvageButtonRef}
                craftingCurrencies={craftingCurrencies}
                hasSalvageableGear={sharedInventory.some((item) => !combatRestrictions.gear[item.instanceId])}
                lockedCharacterName={locked && requiredCharacterId ? characters[requiredCharacterId].name : null}
                onSelectSlot={handleSlotSelect}
                onUnequipSlot={handleSlotUnequip}
                onUnequipTrinket={handleUnequipTrinket}
                onSalvage={beginSalvage}
                onApplyCurrency={handleApplyCurrency}
                onCombatLockedAttempt={handleCombatLockedAttempt}
                onSelectCurrency={handleSelectCurrency}
                onToggleSalvageMode={() => {
                  setNotice("");
                  setCraftingResult(null);
                  toggleSalvage();
                }}
              />
              <ArmoryPickerPanel
                combatRestrictions={combatRestrictions}
                selectedSlot={selectedSlot}
                characterId={characterId}
                pickerItems={pickerItems}
                ownedTrinkets={ownedTrinkets}
                equippedTrinkets={equippedTrinkets}
                loadout={loadout}
                loadouts={loadouts}
                inventory={sharedInventory}
                targeting={{ editable, salvageMode, activeCurrencyId, craftingResult }}
                actions={{
                  onEquipGear: handleEquipGear,
                  onEquipTrinket: handleEquipTrinket,
                  onSalvage: beginSalvage,
                  onApplyCurrency: handleApplyCurrency,
                  onCombatLockedAttempt: handleCombatLockedAttempt,
                }}
                onSpawnDevGear={onSpawnDevGear}
                onSort={handleSort}
                page={ordering.safePage}
                totalPages={ordering.totalPages}
                onPageChange={handlePageChange}
                fillerCount={ordering.fillerCount}
                pagedGear={ordering.pagedGear}
                pagedTrinkets={ordering.pagedTrinkets}
                placeholderIndex={ordering.placeholderLocalIndex}
                hiddenArtworkIds={hiddenArtworkIds}
              />
            </div>
          </FadeSlot>
        </div>
        <ArmoryFeedback
          notice={notice}
          result={craftingResult}
          after={craftedItem}
          error={notice === COMBAT_LOCKED_MESSAGE}
          onDismiss={() => {
            setNotice("");
            setCraftingResult(null);
          }}
        />
        <ArmoryOverlays
          returnFocusRef={salvageButtonRef}
          salvagePending={salvagePending}
          activeCurrencyId={activeCurrencyId}
          editable={editable}
          equippedCharacterName={equippedSalvageCharacter ? characters[equippedSalvageCharacter].name : null}
          onSalvage={(instanceId) => {
            const success = onSalvage(instanceId);
            if (success)
              setNotice(
                `${salvagePending ? getGearInstanceTitle(salvagePending.instance) : "Item"} salvaged. Rewards added.`,
              );
            return success;
          }}
          onClearSalvageTarget={clearTargeting}
        />
        <ArmoryTransferOverlay flyingItems={flyingItems} onComplete={settleActiveTransfers} />
      </div>
    </PageLayout>
  );
}
