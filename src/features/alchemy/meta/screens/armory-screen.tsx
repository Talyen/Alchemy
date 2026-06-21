import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  canApplyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  findGearInventoryOwner,
  buildArmoryBoardView,
  type CraftingCurrencyId,
  type GearInstance,
  type GearInventories,
  type GearLoadouts,
  type GearSlot,
  type InventoryPlacement,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { characters, getRequiredPreviousCharacter, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { HamburgerTrigger, PageLayout, ScreenHeader } from "../../shared/ui/shared-ui";
import { useGearStore } from "../../shared/stores/gear-store";
import { CharacterAndEquipmentPanel, InventoryPanel } from "./armory/armory-panels";
import { resolveEquipSwap } from "./armory/resolve-equip-swap";
import { useArmoryGearDrag } from "./armory/use-armory-gear-drag";
import { useArmoryCurrencyDrag } from "./armory/use-armory-currency-drag";
import { ArmoryCharacterTabs } from "./armory/armory-character-tabs";
import {
  armoryTargetingReducer,
  initialArmoryTargetingState,
  type ArmoryCursorPoint,
} from "./armory/armory-targeting-state";
import { useArmoryTargetingEvents } from "./armory/use-armory-targeting-events";
import { ArmoryOverlays } from "./armory/armory-overlays";
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
  onSalvage: (instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onTransferGear?: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onSortBoard?: (characterId: CharacterId) => void;
};

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
  onTransferGear = () => false,
  onSortBoard,
  craftingCurrencies = EMPTY_CRAFTING_CURRENCIES,
  onApplyCurrency = () => false,
}: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const inventoryBoardRef = useRef<HTMLDivElement>(null);
  const [targeting, dispatchTargeting] = useReducer(armoryTargetingReducer, initialArmoryTargetingState);
  const [cursorPoint, setCursorPoint] = useState<ArmoryCursorPoint | null>(null);
  const { salvageTarget, salvageMode, activeCurrencyId, transferMenu } = targeting;
  const characterInventory = useMemo(() => inventories[characterId], [inventories, characterId]);
  const savedPositions = useGearStore((state) => state.boardPositionsByCharacter[characterId]);
  const moveBoardItem = useGearStore((state) => state.moveBoardItem);
  const handleMoveItem = useCallback(
    (instanceId: string, col: number, row: number) => {
      moveBoardItem(characterId, { kind: "gear", id: instanceId }, col, row);
    },
    [characterId, moveBoardItem],
  );

  const savedCurrencyPositions = useGearStore((state) => state.currencyBoardPositionsByCharacter[characterId]);
  const handleMoveCurrency = useCallback(
    (currencyId: CraftingCurrencyId, col: number, row: number) => {
      moveBoardItem(characterId, { kind: "currency", id: currencyId }, col, row);
    },
    [characterId, moveBoardItem],
  );

  const inventoryById = useMemo(
    () => new Map(characterInventory.map((item) => [item.instanceId, item])),
    [characterInventory],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
  const editable = !browseOnly && !locked;
  const boardView = useMemo(
    () =>
      buildArmoryBoardView({
        inventory: characterInventory,
        loadout,
        gearPositions: savedPositions,
        currencyPositions: savedCurrencyPositions,
        craftingCurrencies,
      }),
    [characterInventory, craftingCurrencies, loadout, savedCurrencyPositions, savedPositions],
  );

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
        packedItems: boardView.packedInventory.items,
      });

      onEquip(targetCharacterId, slot, instance, {
        vacatedPlacement,
        swapDisplaced: canSwap,
      });
    },
    [boardView.packedInventory.items, inventoryById, loadouts, onEquip],
  );

  const {
    draggedGear,
    dragVisual,
    carriedInstance,
    secondaryDragVisuals,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    startCarry,
    carriedCurrencyId,
    carriedCurrencyVisual,
    startCarryCurrency,
  } = useArmoryGearDrag({
    characterId,
    editable,
    loadout,
    inventoryById,
    packedInventory: boardView.packedInventory,
    inventoryBoardRef,
    boardObstacles: boardView.boardObstacles,
    onEquip: handleEquipWithSwap,
    onUnequip,
    onMoveItem: handleMoveItem,
    onMoveCurrency: handleMoveCurrency,
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
    occupiedRows: boardView.occupiedRows,
    inventoryBoardRef,
    onMoveCurrency: handleMoveCurrency,
    boardObstacles: boardView.boardObstacles,
    packedItems: boardView.packedInventory.items,
    packedCurrencies: boardView.packedCurrencies,
    inventoryById,
    onSwapWithItem: (item, rect) => {
      if (item.kind === "gear") {
        startCarry(item.instance, rect);
      } else {
        startCarryCurrency(item.currencyId, rect);
      }
    },
  });

  const secondaryDragInstanceIds = secondaryDragVisuals.flatMap((v) => (v.instance ? [v.instance.instanceId] : []));

  const clearTargeting = useCallback(() => {
    dispatchTargeting({ type: "CLEAR_TARGETING" });
    setCursorPoint(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget,
    clearTargeting,
  });

  const handleSelectCharacter = useCallback((id: CharacterId) => {
    setCharacterId(id);
    setCursorPoint(null);
    dispatchTargeting({ type: "SELECT_CHARACTER" });
  }, []);

  useEffect(() => {
    if (!editable) {
      setTimeout(() => setCursorPoint(null), 0);
      dispatchTargeting({ type: "EDITABLE_LOST" });
    }
  }, [editable]);

  useEffect(() => {
    if (activeCurrencyId && (craftingCurrencies[activeCurrencyId] ?? 0) <= 0) {
      setTimeout(() => setCursorPoint(null), 0);
      dispatchTargeting({ type: "CURRENCY_DEPLETED" });
    }
  }, [activeCurrencyId, craftingCurrencies]);

  useEffect(() => {
    if (salvageTarget && !inventoryById.has(salvageTarget.instanceId)) {
      dispatchTargeting({ type: "SALVAGE_TARGET_GONE" });
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
    dispatchTargeting({ type: "TOGGLE_CURRENCY", currencyId });
  }

  const startSalvageTarget = useCallback((target: GearInstance) => {
    dispatchTargeting({ type: "START_SALVAGE_TARGET", target });
  }, []);

  const handleOpenTransferMenu = useCallback(
    (instance: GearInstance, anchor: { x: number; y: number }) => {
      const owner = findGearInventoryOwner(useGearStore.getState().inventories, instance.instanceId);
      if (!owner) return;
      const recipients = (Object.keys(characters) as CharacterId[])
        .filter((id) => id !== owner)
        .filter((id) => isCharacterUnlocked(id, finishedRunCharacters));
      if (recipients.length === 0) return;
      dispatchTargeting({
        type: "OPEN_TRANSFER_MENU",
        instanceId: instance.instanceId,
        sourceCharacterId: owner,
        anchor,
      });
    },
    [finishedRunCharacters],
  );

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
      setCursorPoint(null);
      dispatchTargeting({ type: "DESELECT_CURRENCY" });
    }
  }

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "alchemy-shell my-auto flex w-full max-w-[96rem] flex-1 flex-col rounded-shell-screen p-7 pb-1",
          salvageMode && "armory-salvage-cursor",
          draggedGear && "cursor-none [&_*]:!cursor-none",
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
              if (activeCurrencyId) {
                setCursorPoint({ x: event.clientX, y: event.clientY });
              }
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
              secondaryDragInstanceIds={secondaryDragInstanceIds}
              isDraggingActive={isDraggingActive}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              onGearPointerStart={beginGearPointer}
              onGearPointerMove={moveGearPointer}
              onGearPointerEnd={finishGearPointer}
              onGearDoubleClick={handleGearDoubleClick}
              onSalvage={startSalvageTarget}
              onApplyCurrency={handleApplyCurrency}
              onAbortGearDrag={abortGearDragIfDragging}
              onTransferRequest={handleOpenTransferMenu}
            />
            <InventoryPanel
              packedItems={boardView.packedInventory.items}
              packedCurrencies={boardView.packedCurrencies}
              occupiedRows={boardView.occupiedRows}
              editable={editable}
              draggedInstanceId={draggedGear?.instanceId ?? null}
              draggedCurrencyId={draggedCurrencyId}
              secondaryDragInstanceIds={secondaryDragInstanceIds}
              isDraggingActive={isDraggingActive || isCurrencyDraggingActive || !!carriedInstance}
              boardRef={inventoryBoardRef}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              onSalvage={startSalvageTarget}
              hasSalvageableGear={
                editable && (characterInventory.length > 0 || Object.values(loadouts[characterId]).some(Boolean))
              }
              onToggleSalvageMode={() => dispatchTargeting({ type: "TOGGLE_SALVAGE_MODE" })}
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
              onTransferRequest={handleOpenTransferMenu}
              {...(onSortBoard ? { onSortBoard: () => onSortBoard(characterId) } : {})}
            />
          </div>
        </div>
        <ArmoryOverlays
          salvageTarget={salvageTarget}
          currencyDragVisual={currencyDragVisual}
          dragVisual={dragVisual}
          secondaryDragVisuals={secondaryDragVisuals}
          activeCurrencyId={activeCurrencyId}
          cursorPoint={cursorPoint}
          transferMenu={transferMenu}
          craftingCurrencies={craftingCurrencies}
          finishedRunCharacters={finishedRunCharacters}
          editable={editable}
          carriedCurrencyId={carriedCurrencyId}
          carriedCurrencyVisual={carriedCurrencyVisual}
          onSalvage={onSalvage}
          onTransferGear={onTransferGear}
          onClearSalvageTarget={() => dispatchTargeting({ type: "CLEAR_SALVAGE_TARGET" })}
          onClearCurrencyDragState={clearCurrencyDragState}
          onClearDragState={clearDragState}
          onClearSecondaryDragState={clearSecondaryDragState}
          onCloseTransferMenu={() => dispatchTargeting({ type: "CLOSE_TRANSFER_MENU" })}
        />
      </div>
    </PageLayout>
  );
}
