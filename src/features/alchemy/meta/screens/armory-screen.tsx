import { useCallback, useMemo, useState, useRef } from "react";
import { Lock } from "lucide-react";
import {
  EMPTY_CRAFTING_CURRENCIES,
  computeSalvageYield,
  craftingCurrencyBlockedReason,
  findGearEquippedCharacter,
  getGearInstanceTitle,
  flattenGearInventories,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
  type ArmorySlot,
} from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import type { CraftingResult } from "./armory/crafting-result";
import { ArmoryFeedback } from "./armory/armory-feedback";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, screenShellPaddingClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  type CharacterId,
  trinketLibrary,
  trinketById,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { FadeSlot } from "../../shared/ui/use-fade";
import { PageLayout } from "../../shared/ui/shared-ui";
import { renderUnlockMessage } from "../../shared/ui/unlock-text";
import { ArmoryCharacterTabs, ArmoryOverlays, type ArmoryScreenProps } from "./armory";
import { ScreenHeaderRow } from "../../shared/ui/shared-ui";
import { applyCurrencyToGear, itemsMatchingSlot } from "./armory/armory-screen-actions";
import { COMBAT_LOCKED_MESSAGE } from "./armory/armory-item-state";
import { useArmoryTargetingState } from "./armory/use-armory-targeting-state";
import { ArmoryPickerPanel } from "./armory/armory-picker-panel";
import { EquipmentSlotButton } from "./armory/parts/equipment-slot-button";
import { CraftingStrip } from "./armory/parts/crafting-strip";
import { EQUIP_SLOTS } from "./armory/parts/slot-labels";
import { TrinketSlotButton } from "./armory/parts/trinket-slot-button";
import "./armory/armory-screen.css";

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

  const {
    salvageMode,
    setSalvageMode,
    activeCurrencyId,
    setActiveCurrencyId,
    salvagePending,
    setSalvagePending,
    clearTargeting,
  } = useArmoryTargetingState({ editable, craftingCurrencies, characterId, inventoryById });

  const handleSelectCharacter = useCallback(
    (id: CharacterId) => {
      setCharacterId(id);
      setCraftingResult(null);
      setNotice("");
      clearTargeting();
    },
    [clearTargeting],
  );

  const handleCombatLockedAttempt = useCallback(() => {
    if (!browseOnly) return;
    setNotice(COMBAT_LOCKED_MESSAGE);
    playUISound("error");
  }, [browseOnly]);

  function handleSelectCurrency(currencyId: CraftingCurrencyId) {
    if (!editable) {
      handleCombatLockedAttempt();
      return;
    }
    if (craftingCurrencies[currencyId] <= 0) return;
    setActiveCurrencyId((current) => (current === currencyId ? null : currencyId));
    setSalvageMode(false);
    setCraftingResult(null);
    setNotice("");
  }

  const beginSalvage = useCallback(
    (instance: GearInstance) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
      if (combatRestrictions.gear[instance.instanceId]) return;
      setSalvageMode(false);
      setActiveCurrencyId(null);
      setNotice("");
      setCraftingResult(null);
      setSalvagePending({ instance, yield: computeSalvageYield(instance) });
    },
    [
      editable,
      combatRestrictions.gear,
      handleCombatLockedAttempt,
      setActiveCurrencyId,
      setSalvageMode,
      setSalvagePending,
    ],
  );

  const handleApplyCurrency = useCallback(
    (instance: GearInstance) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
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
        clearCurrency: () => setActiveCurrencyId(null),
      });
      if (applied) {
        setNotice("");
        setCraftingResult({ before: instance, currencyId: activeCurrencyId });
      } else setNotice("Crafting could not be completed. No currency was spent.");
    },
    [
      editable,
      activeCurrencyId,
      onApplyCurrency,
      combatRestrictions.gear,
      handleCombatLockedAttempt,
      setActiveCurrencyId,
    ],
  );

  const handleSlotSelect = useCallback(
    (slot: ArmorySlot) => {
      setSelectedSlot(slot);
      if (slot === "trinket") clearTargeting();
    },
    [clearTargeting],
  );
  const handleSlotUnequip = useCallback(
    (slot: GearSlot) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
      onUnequip(characterId, slot);
    },
    [editable, handleCombatLockedAttempt, onUnequip, characterId],
  );

  const equippedSalvageCharacter = salvagePending
    ? findGearEquippedCharacter(loadouts, salvagePending.instance.instanceId)
    : null;
  const craftedItem = craftingResult ? inventoryById.get(craftingResult.before.instanceId) : undefined;
  const handleEquipGear = useCallback(
    (instance: GearInstance) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
      if (selectedSlot !== "trinket") onEquip(characterId, selectedSlot, instance);
    },
    [editable, handleCombatLockedAttempt, selectedSlot, onEquip, characterId],
  );
  const handleEquipTrinket = useCallback(
    (trinketId: string) => {
      if (!editable) {
        handleCombatLockedAttempt();
        return;
      }
      onEquipTrinket(characterId, trinketId);
    },
    [editable, handleCombatLockedAttempt, onEquipTrinket, characterId],
  );
  const handleUnequipTrinket = useCallback(() => {
    if (!editable) {
      handleCombatLockedAttempt();
      return;
    }
    onUnequipTrinket(characterId);
  }, [editable, handleCombatLockedAttempt, onUnequipTrinket, characterId]);

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
              <section
                data-testid="armory-left-panel"
                className="alchemy-shell relative flex min-w-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4"
              >
                <div className="relative flex min-h-10 w-full items-center justify-center">
                  <h2 className={cn("text-center font-sans", sectionTitleClass)}>Equipment</h2>
                </div>
                <div
                  data-testid="armory-equipment-board"
                  className={cn("mt-2 grid w-full grid-cols-3", collectionGridGapXClass, "gap-y-6")}
                >
                  {EQUIP_SLOTS.map((slot) => {
                    if (slot === "trinket") {
                      return (
                        <TrinketSlotButton
                          key={slot}
                          trinket={equippedTrinket}
                          selected={selectedSlot === slot}
                          editable={editable}
                          onSelect={() => handleSlotSelect(slot)}
                          onUnequip={handleUnequipTrinket}
                          onCombatLockedAttempt={handleCombatLockedAttempt}
                        />
                      );
                    }
                    const instanceId = loadout[slot];
                    const instance = instanceId ? inventoryById.get(instanceId) : undefined;
                    return (
                      <EquipmentSlotButton
                        key={slot}
                        slot={slot}
                        instance={instance}
                        selected={selectedSlot === slot}
                        editable={editable}
                        salvageMode={salvageMode}
                        activeCurrencyId={activeCurrencyId}
                        onSelect={handleSlotSelect}
                        onUnequip={handleSlotUnequip}
                        craftingResult={craftingResult}
                        onSalvage={beginSalvage}
                        onApplyCurrency={handleApplyCurrency}
                        onCombatLockedAttempt={handleCombatLockedAttempt}
                      />
                    );
                  })}
                </div>
                <CraftingStrip
                  salvageButtonRef={salvageButtonRef}
                  craftingCurrencies={craftingCurrencies}
                  activeCurrencyId={activeCurrencyId}
                  salvageMode={salvageMode}
                  editable={editable}
                  hasSalvageableGear={sharedInventory.some((item) => !combatRestrictions.gear[item.instanceId])}
                  onSelectCurrency={handleSelectCurrency}
                  onToggleSalvageMode={() => {
                    setNotice("");
                    setCraftingResult(null);
                    setSalvageMode((current) => !current);
                    setActiveCurrencyId(null);
                  }}
                />
                {locked && requiredCharacterId ? (
                  <div className="absolute inset-0 z-40 flex items-center justify-center rounded-shell-dialog bg-black/70 p-5">
                    <div className="max-w-xs text-center">
                      <Lock className="mx-auto h-8 w-8" />
                      <p className="mt-2 font-semibold">
                        {renderUnlockMessage(`Finish a Run as the ${characters[requiredCharacterId].name} to unlock`)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
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
          onSalvage={(instanceId, salvageYield) => {
            const success = onSalvage(instanceId, salvageYield);
            if (success)
              setNotice(
                `${salvagePending ? getGearInstanceTitle(salvagePending.instance) : "Item"} salvaged. Rewards added.`,
              );
            return success;
          }}
          onClearSalvageTarget={() => setSalvagePending(null)}
        />
      </div>
    </PageLayout>
  );
}
