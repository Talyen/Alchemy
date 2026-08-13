import { useCallback, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { Dices } from "lucide-react";
import {
  EMPTY_CRAFTING_CURRENCIES,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { Button } from "@/components/ui/button";
import { PageLayout } from "../../shared/ui/shared-ui";
import {
  ArmoryCharacterTabs,
  useArmoryTargetingEvents,
  ArmoryOverlays,
  ArmoryScreenHeader,
  useArmoryResetEffects,
  type ArmoryCursorPoint,
  type ArmoryScreenProps,
} from "./armory";
import { applyCurrencyToGear, resetArmoryTargeting } from "./armory/armory-screen-actions";
import { EquipmentSlotButton } from "./armory/parts/equipment-slot-button";
import { CraftingStrip } from "./armory/parts/crafting-strip";
import { EQUIP_SLOTS } from "./armory/parts/slot-labels";
import { ItemPickerGrid } from "./armory/item-picker-grid";
import "./armory/armory-screen.css";

function itemsMatchingSlot(inventory: GearInstance[], slot: GearSlot): GearInstance[] {
  return inventory.filter((item) => {
    const definition = gearDefinitions[item.definitionId];
    return definition?.compatibleSlots.includes(slot) ?? false;
  });
}

export function ArmoryScreen({
  inventories,
  loadouts,
  finishedRunCharacters,
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onSalvage,
  onSpawnDevGear,
  craftingCurrencies = EMPTY_CRAFTING_CURRENCIES,
  onApplyCurrency = () => false,
}: ArmoryScreenProps) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [selectedSlot, setSelectedSlot] = useState<GearSlot>("main-hand");
  const [salvageMode, setSalvageMode] = useState(false);
  const [salvageTarget, setSalvageTarget] = useState<GearInstance | null>(null);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [cursorPoint, setCursorPoint] = useState<ArmoryCursorPoint | null>(null);
  const characterInventory = useMemo(() => inventories[characterId], [inventories, characterId]);
  const inventoryById = useMemo(
    () => new Map(characterInventory.map((item) => [item.instanceId, item])),
    [characterInventory],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
  const editable = !browseOnly && !locked;
  const pickerItems = useMemo(() => {
    const matching = itemsMatchingSlot(characterInventory, selectedSlot);
    const equippedId = loadout[selectedSlot];
    return [...matching].sort((a, b) => {
      if (a.instanceId === equippedId) return -1;
      if (b.instanceId === equippedId) return 1;
      return 0;
    });
  }, [characterInventory, loadout, selectedSlot]);
  const siblingEquippedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of EQUIP_SLOTS) {
      const id = loadout[slot];
      if (id && slot !== selectedSlot) ids.add(id);
    }
    return ids;
  }, [loadout, selectedSlot]);

  const handleSelectCharacter = useCallback((id: CharacterId) => {
    setCharacterId(id);
    resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setCursorPoint, setSalvageTarget });
  }, []);

  useArmoryResetEffects({
    editable,
    craftingCurrencies,
    activeCurrencyId,
    characterId,
    inventoryById,
    salvageTarget,
    setCursorPoint,
    setSalvageMode,
    setSalvageTarget,
    setActiveCurrencyId,
  });
  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget,
    clearTargeting: () =>
      resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setCursorPoint, setSalvageTarget }),
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

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "alchemy-shell my-auto flex w-full max-w-[96rem] flex-1 flex-col rounded-shell-screen p-[2.1rem] pb-1",
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
          <div className="armory-workspace-grid">
            <section
              data-testid="armory-left-panel"
              className="alchemy-shell relative flex min-w-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4"
            >
              <h2 className="text-center font-sans text-lg text-amber-100">Equipment</h2>
              <div
                data-testid="armory-equipment-board"
                className="mt-4 grid w-full max-w-[min(100%,28rem)] grid-cols-3 gap-3"
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
                      onSalvage={() => {
                        const instance = instanceId ? inventoryById.get(instanceId) : undefined;
                        if (instance) setSalvageTarget(instance);
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
                hasSalvageableGear={characterInventory.length > 0}
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
              {onSpawnDevGear && editable ? (
                <div className="mb-2 flex justify-end">
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
              <ItemPickerGrid
                slot={selectedSlot}
                items={pickerItems}
                loadout={loadout}
                inventory={characterInventory}
                equippedInstanceId={loadout[selectedSlot]}
                siblingEquippedIds={siblingEquippedIds}
                editable={editable}
                salvageMode={salvageMode}
                activeCurrencyId={activeCurrencyId}
                onEquip={(instance) => onEquip(characterId, selectedSlot, instance)}
                onUnequip={() => onUnequip(characterId, selectedSlot)}
                onSalvage={(instance) => setSalvageTarget(instance)}
                onApplyCurrency={handleApplyCurrency}
              />
            </section>
          </div>
        </div>
        <ArmoryOverlays
          salvageTarget={salvageTarget}
          activeCurrencyId={activeCurrencyId}
          cursorPoint={cursorPoint}
          editable={editable}
          onSalvage={onSalvage}
          onClearSalvageTarget={() => setSalvageTarget(null)}
        />
      </div>
    </PageLayout>
  );
}
