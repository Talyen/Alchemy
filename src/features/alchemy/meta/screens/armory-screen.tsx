import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canApplyCraftingCurrency,
  currencyObstaclesForBoard,
  EMPTY_CRAFTING_CURRENCIES,
  gearDefinitions,
  getCraftingCurrencyDefinition,
  INVENTORY_COLS,
  packInventoryWithPositions,
  packCurrencyWithPositions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearInventories,
  type GearLoadouts,
  type GearSlot,
  type InventoryPlacement,
  type PackedCurrencyItem,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { getRequiredPreviousCharacter, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { ConfirmationDialog, HamburgerTrigger, PageLayout, ScreenHeader } from "../../shared/ui/shared-ui";
import { GearItemTitle } from "../../shared/ui/gear-item-title";
import { useGearStore } from "../../shared/stores/gear-store";
import { Sparkles } from "lucide-react";
import { CharacterAndEquipmentPanel, InventoryPanel } from "./armory/armory-panels";
import { resolveEquipSwap } from "./armory/resolve-equip-swap";
import { useArmoryGearDrag } from "./armory/use-armory-gear-drag";
import { useArmoryInventoryPositions } from "./armory/use-armory-inventory-positions";
import { useArmoryCurrencyPositions } from "./armory/use-armory-currency-positions";
import { useArmoryCurrencyDrag } from "./armory/use-armory-currency-drag";
import { ArmoryCharacterTabs } from "./armory/armory-character-tabs";
import { ArmoryCurrencyCursor } from "./armory/armory-currency-targeting";
import { GearDragVisualPortal } from "./armory/armory-drag-portal";
import { CurrencyDragVisualPortal } from "./armory/armory-currency-drag-portal";
import "./armory/armory-screen.css";

type Props = {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement; swapDisplaced?: boolean },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => void;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
};

export function ArmoryScreen({
  inventories,
  loadouts,
  finishedRunCharacters = [],
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onSalvage,
  onSpawnDevGear,
  craftingCurrencies = EMPTY_CRAFTING_CURRENCIES,
  onApplyCurrency = () => false,
}: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const inventoryBoardRef = useRef<HTMLDivElement>(null);
  const [salvageTarget, setSalvageTarget] = useState<GearInstance | null>(null);
  const [salvageMode, setSalvageMode] = useState(false);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const characterInventory = useMemo(() => inventories[characterId] ?? [], [inventories, characterId]);
  const { savedPositions, handleMoveItem } = useArmoryInventoryPositions(characterId, characterInventory);
  const {
    savedPositions: savedCurrencyPositions,
    activeCurrencyIds,
    handleMoveCurrency,
  } = useArmoryCurrencyPositions(characterId, craftingCurrencies);
  const equippedReturnPositions = useGearStore((state) => state.equippedReturnPositions);

  const currencyBlockers = useMemo(
    () =>
      activeCurrencyIds.flatMap((id) => {
        const position = savedCurrencyPositions[id];
        if (!position) return [];
        return [{ col: position.col, row: position.row, w: 1, h: 1 }];
      }),
    [activeCurrencyIds, savedCurrencyPositions],
  );

  const inventoryById = useMemo(
    () => new Map(characterInventory.map((item) => [item.instanceId, item])),
    [characterInventory],
  );
  const equippedInstanceIds = useMemo(
    () => new Set(Object.values(loadouts[characterId]).filter(Boolean)),
    [loadouts, characterId],
  );
  const availableInventory = useMemo(
    () => characterInventory.filter((item) => !equippedInstanceIds.has(item.instanceId)),
    [characterInventory, equippedInstanceIds],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
  const editable = !browseOnly && !locked;
  const packedInventory = useMemo(() => {
    const reservedEquipped = characterInventory.filter((item) => equippedInstanceIds.has(item.instanceId));
    return packInventoryWithPositions(
      availableInventory,
      INVENTORY_COLS,
      savedPositions,
      reservedEquipped,
      currencyBlockers,
    );
  }, [availableInventory, characterInventory, currencyBlockers, equippedInstanceIds, savedPositions]);

  const packedCurrencies = useMemo(
    () => packCurrencyWithPositions(activeCurrencyIds, INVENTORY_COLS, savedCurrencyPositions, packedInventory.items),
    [activeCurrencyIds, packedInventory.items, savedCurrencyPositions],
  );

  const boardObstacles = useMemo(
    () => [...packedInventory.items, ...currencyObstaclesForBoard(packedCurrencies as PackedCurrencyItem[])],
    [packedCurrencies, packedInventory.items],
  );

  const occupiedRows = useMemo(() => {
    const currencyRows = packedCurrencies.reduce((max, item) => Math.max(max, item.row), 0);
    return Math.max(packedInventory.occupiedRows, currencyRows);
  }, [packedCurrencies, packedInventory.occupiedRows]);

  const handleEquipWithSwap = useCallback(
    (
      targetCharacterId: CharacterId,
      slot: GearSlot,
      instance: GearInstance,
      options?: { vacatedPlacement?: InventoryPlacement },
    ) => {
      const vacatedPlacement = options?.vacatedPlacement;
      if (!vacatedPlacement) {
        onEquip(targetCharacterId, slot, instance);
        return;
      }

      const { canSwap } = resolveEquipSwap({
        loadout: loadouts[targetCharacterId],
        slot,
        instance,
        vacatedPlacement,
        inventoryById,
        packedItems: packedInventory.items,
      });

      onEquip(targetCharacterId, slot, instance, {
        vacatedPlacement,
        swapDisplaced: canSwap,
      });
    },
    [inventoryById, loadouts, onEquip, packedInventory.items],
  );

  const {
    draggedGear,
    dragVisual,
    secondaryDragVisual,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortGearDragIfDragging,
  } = useArmoryGearDrag({
    characterId,
    editable,
    loadout,
    inventoryById,
    packedInventory,
    inventoryBoardRef,
    boardPositions: savedPositions,
    equippedReturnPositions,
    boardObstacles,
    onEquip: handleEquipWithSwap,
    onUnequip,
    onMoveItem: handleMoveItem,
  });

  const {
    draggedCurrencyId,
    dragVisual: currencyDragVisual,
    isDraggingActive: isCurrencyDraggingActive,
    beginCurrencyPointer,
    moveCurrencyPointer,
    finishCurrencyPointer,
    clearDragState: clearCurrencyDragState,
  } = useArmoryCurrencyDrag({
    editable,
    occupiedRows,
    inventoryBoardRef,
    onMoveCurrency: handleMoveCurrency,
  });

  const dragDefinition = dragVisual ? gearDefinitions[dragVisual.instance.definitionId] : undefined;
  const secondaryDragDefinition = secondaryDragVisual
    ? gearDefinitions[secondaryDragVisual.instance.definitionId]
    : undefined;

  const clearTargeting = useCallback(() => {
    setSalvageMode(false);
    setActiveCurrencyId(null);
    setCursorPoint(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    if (!salvageMode && !activeCurrencyId) return;
    if (salvageTarget) return;

    function isTargetingElement(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        !!target.closest('[data-testid="armory-workspace"]') ||
        !!target.closest('[data-testid="confirmation-dialog"]') ||
        !!target.closest('[data-testid="armory-inventory-item"]') ||
        !!target.closest('[data-testid="armory-equipment-slot"]') ||
        !!target.closest('[data-testid="armory-crafting-currency"]') ||
        !!target.closest(".armory-salvage-tile") ||
        !!target.closest('[data-testid="armory-salvage-toggle"]')
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      clearTargeting();
      event.preventDefault();
      event.stopPropagation();
    }

    function handleClick(event: MouseEvent) {
      if (salvageMode) {
        if (
          event.target instanceof HTMLElement &&
          (event.target.closest('[data-salvageable="true"]') ||
            event.target.closest('[data-testid="armory-salvage-toggle"]'))
        ) {
          return;
        }
        clearTargeting();
        return;
      }
      if (isTargetingElement(event.target)) return;
      clearTargeting();
    }

    function handleContextMenu(event: MouseEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('[data-testid="armory-crafting-currency"]')) {
        return;
      }
      event.preventDefault();
      clearTargeting();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [activeCurrencyId, clearTargeting, salvageMode, salvageTarget]);

  const handleSelectCharacter = useCallback((id: CharacterId) => {
    setCharacterId(id);
    setSalvageMode(false);
    setActiveCurrencyId(null);
    setCursorPoint(null);
    setSalvageTarget(null);
  }, []);

  useEffect(() => {
    if (!editable) {
      setSalvageMode(false); // eslint-disable-line react-hooks/set-state-in-effect
      setActiveCurrencyId(null);
      setCursorPoint(null);
      setSalvageTarget(null);
    }
  }, [editable]);

  useEffect(() => {
    if (activeCurrencyId && (craftingCurrencies[activeCurrencyId] ?? 0) <= 0) {
      setActiveCurrencyId(null); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [activeCurrencyId, craftingCurrencies]);

  useEffect(() => {
    if (salvageTarget && !inventoryById.has(salvageTarget.instanceId)) {
      setSalvageTarget(null); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [salvageTarget, inventoryById]);

  useEffect(() => {
    if (!editable) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [editable]);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [characterId]);

  function handleSelectCurrency(currencyId: CraftingCurrencyId) {
    if (!editable || (craftingCurrencies[currencyId] ?? 0) <= 0) return;
    setSalvageMode(false);
    setActiveCurrencyId((current) => (current === currencyId ? null : currencyId));
    playUISound("toggleOn");
  }

  function handleApplyCurrency(instance: GearInstance) {
    if (!editable) return;
    if (!activeCurrencyId) return;
    if (!canApplyCraftingCurrency(activeCurrencyId, instance)) {
      playUISound("error");
      return;
    }
    const ok = onApplyCurrency(activeCurrencyId, instance.instanceId);
    if (!ok) {
      playUISound("error");
      return;
    }
    playUISound("talentUnlock");
    if ((craftingCurrencies[activeCurrencyId] ?? 0) <= 1) {
      setActiveCurrencyId(null);
    }
  }

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "alchemy-shell my-auto flex w-full max-w-[96rem] flex-1 flex-col rounded-shell-screen p-7 pb-1",
          salvageMode && "armory-salvage-cursor",
          draggedGear && "cursor-grabbing [&_*]:!cursor-grabbing",
        )}
      >
        <div className="relative flex min-h-10 w-full items-center justify-center px-12">
          <ScreenHeader title="Armory" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <HamburgerTrigger onClick={onOpenMenu} label="Open armory menu" />
          </div>
        </div>
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
        <div className="armory-workspace mt-2 min-w-0 flex-1" data-testid="armory-workspace">
          <div
            className="armory-workspace-grid"
            onPointerMove={(event) => {
              if (activeCurrencyId) setCursorPoint({ x: event.clientX, y: event.clientY });
            }}
            onPointerLeave={() => setCursorPoint(null)}
          >
            <CharacterAndEquipmentPanel
              characterId={characterId}
              locked={locked}
              loadout={loadout}
              inventoryById={inventoryById}
              editable={editable}
              requiredCharacterId={requiredCharacterId}
              draggedGear={draggedGear}
              secondaryDragInstanceId={secondaryDragVisual?.instance.instanceId ?? null}
              isDraggingActive={isDraggingActive}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              onGearPointerStart={beginGearPointer}
              onGearPointerMove={moveGearPointer}
              onGearPointerEnd={finishGearPointer}
              onGearDoubleClick={handleGearDoubleClick}
              onSalvage={setSalvageTarget}
              onApplyCurrency={handleApplyCurrency}
              onAbortGearDrag={abortGearDragIfDragging}
            />
            <InventoryPanel
              packedItems={packedInventory.items}
              packedCurrencies={packedCurrencies}
              occupiedRows={occupiedRows}
              editable={editable}
              draggedInstanceId={draggedGear?.instanceId ?? null}
              draggedCurrencyId={draggedCurrencyId}
              secondaryDragInstanceId={secondaryDragVisual?.instance.instanceId ?? null}
              isDraggingActive={isDraggingActive || isCurrencyDraggingActive}
              boardRef={inventoryBoardRef}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              onSalvage={setSalvageTarget}
              hasSalvageableGear={
                editable && (characterInventory.length > 0 || Object.values(loadouts[characterId]).some(Boolean))
              }
              onToggleSalvageMode={() => {
                setActiveCurrencyId(null);
                setSalvageMode((active) => !active);
              }}
              onSelectCurrency={handleSelectCurrency}
              {...(onSpawnDevGear ? { onSpawnDevGear: () => onSpawnDevGear(characterId) } : {})}
              onGearPointerStart={beginGearPointer}
              onGearPointerMove={moveGearPointer}
              onGearPointerEnd={finishGearPointer}
              onGearDoubleClick={handleGearDoubleClick}
              onCurrencyPointerStart={beginCurrencyPointer}
              onCurrencyPointerMove={moveCurrencyPointer}
              onCurrencyPointerEnd={finishCurrencyPointer}
              craftingCurrencies={craftingCurrencies}
              onApplyCurrency={handleApplyCurrency}
              onAbortGearDrag={abortGearDragIfDragging}
            />
          </div>
        </div>
        {salvageTarget ? (
          <ConfirmationDialog
            title={
              <>
                Salvage <GearItemTitle instance={salvageTarget} />?
              </>
            }
            description="Salvaging items yields crafting materials"
            confirmLabel="Salvage"
            icon={Sparkles}
            dimBackground={false}
            dismissOnBackdrop={false}
            onCancel={() => setSalvageTarget(null)}
            onConfirm={() => {
              if (!editable) {
                setSalvageTarget(null);
                return;
              }
              onSalvage(salvageTarget.instanceId);
              setSalvageTarget(null);
            }}
          />
        ) : null}
        {currencyDragVisual ? (
          <CurrencyDragVisualPortal
            visual={currencyDragVisual}
            art={getCraftingCurrencyDefinition(currencyDragVisual.currencyId).art}
            count={craftingCurrencies[currencyDragVisual.currencyId] ?? 0}
            onComplete={clearCurrencyDragState}
          />
        ) : null}
        {dragVisual && dragDefinition ? (
          <GearDragVisualPortal visual={dragVisual} art={dragDefinition.art} onComplete={clearDragState} />
        ) : null}
        {secondaryDragVisual && secondaryDragDefinition ? (
          <GearDragVisualPortal
            visual={secondaryDragVisual}
            art={secondaryDragDefinition.art}
            testId="armory-gear-swap-visual"
            onComplete={clearSecondaryDragState}
          />
        ) : null}
        <ArmoryCurrencyCursor activeCurrencyId={activeCurrencyId} cursorPoint={cursorPoint} />
      </div>
    </PageLayout>
  );
}
