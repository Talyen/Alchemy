import { useCallback, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  EMPTY_CRAFTING_CURRENCIES,
  computeSalvageYield,
  flattenGearInventories,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
  type ArmorySlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, screenShellPaddingClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  type CharacterId,
  trinketLibrary,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { PageLayout } from "../../shared/ui/shared-ui";
import {
  ArmoryCharacterTabs,
  useArmoryTargetingEvents,
  ArmoryOverlays,
  ArmoryScreenHeader,
  useArmoryResetEffects,
  type ArmorySalvagePending,
  type ArmoryScreenProps,
} from "./armory";
import { applyCurrencyToGear, itemsMatchingSlot, resetArmoryTargeting } from "./armory/armory-screen-actions";
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
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onEquipTrinket,
  onUnequipTrinket,
  onSalvage,
  onApplyCurrency = () => false,
  onSpawnDevGear,
  rng,
}: ArmoryScreenProps) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [selectedSlot, setSelectedSlot] = useState<ArmorySlot>("main-hand");
  const [salvageMode, setSalvageMode] = useState(false);
  const [salvagePending, setSalvagePending] = useState<ArmorySalvagePending | null>(null);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const sharedInventory = useMemo(() => flattenGearInventories(inventories), [inventories]);
  const inventoryById = useMemo(
    () => new Map(sharedInventory.map((item) => [item.instanceId, item])),
    [sharedInventory],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
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
  const equippedTrinket = trinketLibrary.find((entry) => entry.id === equippedTrinkets[characterId]);

  const handleSelectCharacter = useCallback(
    (id: CharacterId) => {
      setCharacterId(id);
      resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setSalvagePending });
    },
    [setActiveCurrencyId, setSalvageMode, setSalvagePending],
  );

  useArmoryResetEffects({
    editable,
    craftingCurrencies,
    activeCurrencyId,
    characterId,
    inventoryById,
    salvagePending,
    salvageMode,
    setSalvageMode,
    setSalvagePending,
    setActiveCurrencyId,
  });
  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget: salvagePending?.instance ?? null,
    clearTargeting: () => resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setSalvagePending }),
  });

  function handleSelectCurrency(currencyId: CraftingCurrencyId) {
    if (!editable || craftingCurrencies[currencyId] <= 0) return;
    setActiveCurrencyId((current) => (current === currencyId ? null : currencyId));
    setSalvageMode(false);
  }

  const beginSalvage = useCallback(
    (instance: GearInstance) => {
      setSalvagePending({ instance, yield: computeSalvageYield(instance, rng) });
    },
    [rng],
  );

  const handleApplyCurrency = useCallback(
    (instance: GearInstance) => {
      applyCurrencyToGear({
        editable,
        activeCurrencyId,
        instance,
        craftingCurrencies,
        onApplyCurrency,
        clearCurrency: () => setActiveCurrencyId(null),
      });
    },
    [editable, activeCurrencyId, craftingCurrencies, onApplyCurrency],
  );

  const handleSlotSelect = useCallback((slot: ArmorySlot) => {
    setSelectedSlot(slot);
    if (slot === "trinket") resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setSalvagePending });
  }, []);
  const handleSlotUnequip = useCallback((slot: GearSlot) => onUnequip(characterId, slot), [onUnequip, characterId]);

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "my-auto flex w-full max-w-[96rem] flex-1 flex-col pb-1",
          screenShellPaddingClass,
          salvageMode && "armory-salvage-cursor",
        )}
      >
        <ArmoryScreenHeader onOpenMenu={onOpenMenu} />
        {browseOnly ? (
          <p className="mx-auto mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100">
            Equipment can be changed after combat.
          </p>
        ) : null}
        <ArmoryCharacterTabs
          activeTab={characterId}
          finishedRunCharacters={finishedRunCharacters}
          onSelectTab={handleSelectCharacter}
        />
        <div className="armory-workspace mt-2 min-h-0 min-w-0 flex-1" data-testid="armory-workspace">
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
                          onUnequip={() => onUnequipTrinket(characterId)}
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
                        onSalvage={beginSalvage}
                        onApplyCurrency={handleApplyCurrency}
                      />
                    );
                  })}
                </div>
                <CraftingStrip
                  craftingCurrencies={craftingCurrencies}
                  activeCurrencyId={activeCurrencyId}
                  salvageMode={salvageMode}
                  editable={editable}
                  hasSalvageableGear={sharedInventory.length > 0}
                  onSelectCurrency={handleSelectCurrency}
                  onToggleSalvageMode={() => {
                    setSalvageMode((current) => !current);
                    setActiveCurrencyId(null);
                  }}
                />
                {locked && requiredCharacterId ? (
                  <div className="absolute inset-0 z-40 flex items-center justify-center rounded-shell-dialog bg-black/70 p-5">
                    <div className="max-w-xs text-center">
                      <Lock className="mx-auto h-8 w-8" />
                      <p className="mt-2 font-semibold">
                        Finish a Run as the {characters[requiredCharacterId].name} to unlock
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
              <ArmoryPickerPanel
                selectedSlot={selectedSlot}
                characterId={characterId}
                pickerItems={pickerItems}
                ownedTrinkets={ownedTrinkets}
                equippedTrinkets={equippedTrinkets}
                loadout={loadout}
                loadouts={loadouts}
                inventory={sharedInventory}
                editable={editable}
                salvageMode={salvageMode}
                activeCurrencyId={activeCurrencyId}
                onSpawnDevGear={onSpawnDevGear}
                onEquipGear={(instance) => {
                  if (selectedSlot !== "trinket") onEquip(characterId, selectedSlot, instance);
                }}
                onEquipTrinket={(trinketId) => onEquipTrinket(characterId, trinketId)}
                onSalvage={beginSalvage}
                onApplyCurrency={handleApplyCurrency}
              />
            </div>
          </FadeSlot>
        </div>
        <ArmoryOverlays
          salvagePending={salvagePending}
          activeCurrencyId={activeCurrencyId}
          editable={editable}
          onSalvage={onSalvage}
          onClearSalvageTarget={() => setSalvagePending(null)}
        />
      </div>
    </PageLayout>
  );
}
