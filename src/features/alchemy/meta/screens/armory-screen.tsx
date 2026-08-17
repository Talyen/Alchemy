import { useCallback, useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Dices } from "lucide-react";
import {
  EMPTY_CRAFTING_CURRENCIES,
  computeSalvageYield,
  flattenGearInventories,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, screenShellPaddingClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { Button } from "@/components/ui/button";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { PageLayout } from "../../shared/ui/shared-ui";
import {
  ArmoryCharacterTabs,
  useArmoryTargetingEvents,
  ArmoryOverlays,
  ArmoryScreenHeader,
  useArmoryResetEffects,
  type ArmoryCursorPoint,
  type ArmorySalvagePending,
  type ArmoryScreenProps,
} from "./armory";
import { applyCurrencyToGear, resetArmoryTargeting } from "./armory/armory-screen-actions";
import { EquipmentSlotButton } from "./armory/parts/equipment-slot-button";
import { CraftingStrip } from "./armory/parts/crafting-strip";
import { EQUIP_SLOTS, SLOT_LABELS } from "./armory/parts/slot-labels";
import { ItemPickerGrid } from "./armory/item-picker-grid";
import "./armory/armory-screen.css";

function nextSalvageRandom(): number {
  return Math.random();
}

function itemsMatchingSlot(inventory: GearInstance[], slot: GearSlot): GearInstance[] {
  return inventory.filter((item) => {
    const definition = gearDefinitions[item.definitionId];
    return definition?.compatibleSlots.includes(slot) ?? false;
  });
}

export function ArmoryScreen({
  inventories,
  loadouts,
  craftingCurrencies = EMPTY_CRAFTING_CURRENCIES,
  finishedRunCharacters,
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onSalvage,
  onApplyCurrency = () => false,
  onSpawnDevGear,
}: ArmoryScreenProps) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [selectedSlot, setSelectedSlot] = useState<GearSlot>("main-hand");
  const rngRef = useRef(nextSalvageRandom);
  const [salvageMode, setSalvageMode] = useState(false);
  const [salvagePending, setSalvagePending] = useState<ArmorySalvagePending | null>(null);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [cursorPoint, setCursorPoint] = useState<ArmoryCursorPoint | null>(null);
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
    const equippedId = loadout[selectedSlot];
    return itemsMatchingSlot(sharedInventory, selectedSlot).filter((item) => item.instanceId !== equippedId);
  }, [sharedInventory, loadout, selectedSlot]);

  const handleSelectCharacter = useCallback(
    (id: CharacterId) => {
      setCharacterId(id);
      resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setCursorPoint, setSalvagePending });
    },
    [setActiveCurrencyId, setCursorPoint, setSalvageMode, setSalvagePending],
  );

  useArmoryResetEffects({
    editable,
    craftingCurrencies,
    activeCurrencyId,
    characterId,
    inventoryById,
    salvagePending,
    setCursorPoint,
    setSalvageMode,
    setSalvagePending,
    setActiveCurrencyId,
  });
  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget: salvagePending?.instance ?? null,
    clearTargeting: () =>
      resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setCursorPoint, setSalvagePending }),
  });

  function handleSelectCurrency(currencyId: CraftingCurrencyId) {
    if (!editable || craftingCurrencies[currencyId] <= 0) return;
    setActiveCurrencyId((current) => (current === currencyId ? null : currencyId));
    setSalvageMode(false);
  }

  function handleApplyCurrency(instance: GearInstance) {
    applyCurrencyToGear({
      editable,
      activeCurrencyId,
      instance,
      craftingCurrencies,
      onApplyCurrency,
      clearCurrency: () => {
        setCursorPoint(null);
        setActiveCurrencyId(null);
      },
    });
  }

  function beginSalvage(instance: GearInstance) {
    setSalvagePending({ instance, yield: computeSalvageYield(instance, rngRef.current) });
  }

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "alchemy-shell my-auto flex w-full max-w-[96rem] flex-1 flex-col rounded-shell-screen pb-1",
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
        <div
          className="armory-workspace mt-2 min-h-0 min-w-0 flex-1"
          data-testid="armory-workspace"
          onPointerMove={(event) => {
            if (activeCurrencyId) setCursorPoint({ x: event.clientX, y: event.clientY });
          }}
          onPointerLeave={() => setCursorPoint(null)}
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
                    const instanceId = loadout[slot];
                    return (
                      <EquipmentSlotButton
                        key={slot}
                        slot={slot}
                        instance={instanceId ? inventoryById.get(instanceId) : undefined}
                        selected={selectedSlot === slot}
                        editable={editable}
                        salvageMode={salvageMode}
                        activeCurrencyId={activeCurrencyId}
                        onSelect={() => setSelectedSlot(slot)}
                        onUnequip={() => onUnequip(characterId, slot)}
                        onSalvage={() => {
                          const instance = instanceId ? inventoryById.get(instanceId) : undefined;
                          if (instance) beginSalvage(instance);
                        }}
                        onApplyCurrency={() => {
                          const instance = instanceId ? inventoryById.get(instanceId) : undefined;
                          if (instance) handleApplyCurrency(instance);
                        }}
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
              <section
                data-testid="armory-right-panel"
                className="alchemy-shell relative flex min-h-0 min-w-0 flex-col rounded-shell-dialog border border-border/80 p-4"
              >
                <div className="relative flex min-h-10 w-full items-center justify-center">
                  <h2 className={cn("text-center font-sans", sectionTitleClass)}>{SLOT_LABELS[selectedSlot]}</h2>
                  {onSpawnDevGear && editable ? (
                    <div className="absolute right-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Spawn random gear"
                        onClick={() => onSpawnDevGear(characterId)}
                      >
                        <Dices className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <ItemPickerGrid
                  slot={selectedSlot}
                  characterId={characterId}
                  items={pickerItems}
                  loadout={loadout}
                  loadouts={loadouts}
                  inventory={sharedInventory}
                  editable={editable}
                  salvageMode={salvageMode}
                  activeCurrencyId={activeCurrencyId}
                  onEquip={(instance) => onEquip(characterId, selectedSlot, instance)}
                  onSalvage={beginSalvage}
                  onApplyCurrency={handleApplyCurrency}
                />
              </section>
            </div>
          </FadeSlot>
        </div>
        <ArmoryOverlays
          salvagePending={salvagePending}
          activeCurrencyId={activeCurrencyId}
          cursorPoint={cursorPoint}
          editable={editable}
          onSalvage={onSalvage}
          onClearSalvageTarget={() => setSalvagePending(null)}
        />
      </div>
    </PageLayout>
  );
}
