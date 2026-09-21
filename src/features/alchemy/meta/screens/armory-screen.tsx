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
  computeSalvageYield,
  craftingCurrencyBlockedReason,
  findGearEquippedCharacter,
  flattenGearInventories,
  getGearInstanceTitle,
  type ArmorySlot,
  type CraftingCurrencyId,
  type GearInstance,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { useCallback, useMemo, useRef, useState } from "react";
import { PageLayout, ScreenHeaderRow } from "../../shared/ui/layout-components";
import { FadeSlot } from "../../shared/ui/use-fade";
import { ArmoryCharacterTabs, ArmoryOverlays, type ArmoryScreenProps } from "./armory";
import { ArmoryEquipmentPanel } from "./armory/armory-equipment-panel";
import { ArmoryFeedback } from "./armory/armory-feedback";
import { COMBAT_LOCKED_MESSAGE } from "./armory/armory-item-state";
import type { ArmorySortOption } from "./armory/armory-ordering";
import { ArmoryPickerPanel } from "./armory/armory-picker-panel";
import { applyCurrencyToGear, itemsMatchingSlot } from "./armory/armory-screen-actions";
import "./armory/armory-screen.css";
import { ArmoryTransferOverlay } from "./armory/armory-transfer-overlay";
import type { CraftingResult } from "./armory/crafting-result";
import { useArmoryOrdering } from "./armory/use-armory-ordering";
import { useArmoryTargetingState } from "./armory/use-armory-targeting-state";
import { useArmoryTransfers } from "./armory/use-armory-transfers";

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

  const {
    salvageMode,
    toggleSalvage,
    activeCurrencyId,
    selectCurrency,
    salvagePending,
    confirmSalvage,
    clearTargeting,
  } = useArmoryTargetingState({ editable, craftingCurrencies, characterId, inventoryById });

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

  const {
    flyingItems,
    hiddenArtworkIds,
    hiddenArtworkSlots,
    settleActiveTransfers,
    handleSlotUnequip,
    handleEquipGear,
    handleEquipTrinket,
    handleUnequipTrinket,
  } = useArmoryTransfers({
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
  });

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

  const equippedSalvageCharacter = salvagePending
    ? findGearEquippedCharacter(loadouts, salvagePending.instance.instanceId)
    : null;
  const craftedItem = craftingResult ? inventoryById.get(craftingResult.before.instanceId) : undefined;

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
