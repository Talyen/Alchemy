import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canApplyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  findGearInventoryOwner,
  buildArmoryBoardView,
  type BoardItemRef,
  type CraftingCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyId,
  type GearBoardPositionsByCharacter,
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
import {
  CharacterAndEquipmentPanel,
  InventoryPanel,
  resolveEquipSwap,
  useArmoryGearDrag,
  useArmoryCurrencyDrag,
  ArmoryCharacterTabs,
  useArmoryTargetingEvents,
  ArmoryOverlays,
  type TransferMenuState,
  type DragRect,
} from "./armory";
import "./armory/armory-screen.css";

interface ArmoryCursorPoint {
  x: number;
  y: number;
}

interface Props {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  gearBoardPositionsByCharacter?: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter?: CraftingCurrencyBoardPositionsByCharacter;
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
  onMoveBoardItem?: (characterId: CharacterId, item: BoardItemRef, col: number, row: number) => void;
  onSortBoard?: (characterId: CharacterId) => void;
}

export function ArmoryScreen({
  inventories,
  loadouts,
  gearBoardPositionsByCharacter,
  currencyBoardPositionsByCharacter,
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
  onMoveBoardItem = () => {},
}: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const inventoryBoardRef = useRef<HTMLDivElement>(null);
  const [salvageMode, setSalvageMode] = useState(false);
  const [salvageTarget, setSalvageTarget] = useState<GearInstance | null>(null);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [transferMenu, setTransferMenu] = useState<TransferMenuState | null>(null);
  const [cursorPoint, setCursorPoint] = useState<ArmoryCursorPoint | null>(null);
  const characterInventory = useMemo(() => inventories[characterId], [inventories, characterId]);
  const savedPositions = useMemo(
    () => gearBoardPositionsByCharacter?.[characterId] ?? {},
    [characterId, gearBoardPositionsByCharacter],
  );
  const handleMoveItem = useCallback(
    (instanceId: string, col: number, row: number) => {
      onMoveBoardItem(characterId, { kind: "gear", id: instanceId }, col, row);
    },
    [characterId, onMoveBoardItem],
  );

  const savedCurrencyPositions = useMemo(
    () => currencyBoardPositionsByCharacter?.[characterId] ?? {},
    [characterId, currencyBoardPositionsByCharacter],
  );
  const handleMoveCurrency = useCallback(
    (currencyId: CraftingCurrencyId, col: number, row: number) => {
      onMoveBoardItem(characterId, { kind: "currency", id: currencyId }, col, row);
    },
    [characterId, onMoveBoardItem],
  );
  const beginHeldCurrencyRef = useRef<
    | ((
        currencyId: CraftingCurrencyId,
        origin: { kind: "inventory"; placement: InventoryPlacement },
        source: DragRect,
      ) => void)
    | null
  >(null);

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
    secondaryDragVisuals,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    beginHeldGear,
  } = useArmoryGearDrag({
    characterId,
    editable,
    loadout,
    inventoryById,
    packedInventory: boardView.packedInventory,
    packedCurrencies: boardView.packedCurrencies,
    inventoryBoardRef,
    boardObstacles: boardView.boardObstacles,
    onEquip: handleEquipWithSwap,
    onUnequip,
    onMoveItem: handleMoveItem,
    onHoldCurrency: (currencyId, origin, source) => beginHeldCurrencyRef.current?.(currencyId, origin, source),
  });

  const {
    draggedCurrencyId,
    dragVisual: currencyDragVisual,
    isDraggingActive: isCurrencyDraggingActive,
    beginCurrencyPointer,
    moveCurrencyPointer,
    finishCurrencyPointer,
    beginHeldCurrency,
    clearDragState: clearCurrencyDragState,
  } = useArmoryCurrencyDrag({
    editable,
    occupiedRows: boardView.occupiedRows,
    inventoryBoardRef,
    onMoveCurrency: handleMoveCurrency,
    packedItems: boardView.packedInventory.items,
    packedCurrencies: boardView.packedCurrencies,
    inventoryById,
    onSwapWithItem: (item, rect) => {
      if (item.kind === "gear") {
        beginHeldGear({ instance: item.instance, origin: item.origin }, rect);
      }
    },
  });

  useEffect(() => {
    beginHeldCurrencyRef.current = beginHeldCurrency;
  }, [beginHeldCurrency]);

  const secondaryDragInstanceIds = secondaryDragVisuals.flatMap((v) => (v.instance ? [v.instance.instanceId] : []));

  const clearTargeting = useCallback(() => {
    setSalvageMode(false);
    setActiveCurrencyId(null);
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
    setSalvageMode(false);
    setSalvageTarget(null);
    setActiveCurrencyId(null);
    setCursorPoint(null);
  }, []);

  useEffect(() => {
    if (!editable) {
      const timer = setTimeout(() => {
        setCursorPoint(null);
        setSalvageMode(false);
        setSalvageTarget(null);
        setActiveCurrencyId(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    return;
  }, [editable]);

  useEffect(() => {
    if (activeCurrencyId && craftingCurrencies[activeCurrencyId] <= 0) {
      const timer = setTimeout(() => {
        setCursorPoint(null);
        setActiveCurrencyId(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    return;
  }, [activeCurrencyId, craftingCurrencies]);

  useEffect(() => {
    if (salvageTarget && !inventoryById.has(salvageTarget.instanceId)) {
      const timer = setTimeout(() => setSalvageTarget(null), 0);
      return () => clearTimeout(timer);
    }
    return;
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
    if (!editable || craftingCurrencies[currencyId] <= 0) return;
    setActiveCurrencyId((current) => (current === currencyId ? null : currencyId));
    setSalvageMode(false);
  }

  const startSalvageTarget = useCallback((target: GearInstance) => {
    setSalvageTarget(target);
  }, []);

  const handleOpenTransferMenu = useCallback(
    (instance: GearInstance, anchor: { x: number; y: number }) => {
      const owner = findGearInventoryOwner(inventories, instance.instanceId);
      if (!owner) return;
      const recipients = (Object.keys(characters) as CharacterId[])
        .filter((id) => id !== owner)
        .filter((id) => isCharacterUnlocked(id, finishedRunCharacters));
      if (recipients.length === 0) return;
      setTransferMenu({
        instanceId: instance.instanceId,
        sourceCharacterId: owner,
        anchor,
      });
    },
    [finishedRunCharacters, inventories],
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
    if (craftingCurrencies[activeCurrencyId] <= 1) {
      setCursorPoint(null);
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
              isDraggingActive={isDraggingActive || isCurrencyDraggingActive}
              boardRef={inventoryBoardRef}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              onSalvage={startSalvageTarget}
              hasSalvageableGear={
                editable && (characterInventory.length > 0 || Object.values(loadouts[characterId]).some(Boolean))
              }
              onToggleSalvageMode={() => {
                setSalvageMode((current) => !current);
                setActiveCurrencyId(null);
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
          onSalvage={onSalvage}
          onTransferGear={onTransferGear}
          onClearSalvageTarget={() => setSalvageTarget(null)}
          onClearCurrencyDragState={clearCurrencyDragState}
          onClearDragState={clearDragState}
          onClearSecondaryDragState={clearSecondaryDragState}
          onCloseTransferMenu={() => setTransferMenu(null)}
        />
      </div>
    </PageLayout>
  );
}
