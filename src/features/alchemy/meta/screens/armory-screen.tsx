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
  type GearPointerStart,
  type GearPointerMove,
  type GearPointerEnd,
  type GearDragOrigin,
  type CurrencyPointerStart,
  type CurrencyPointerMove,
  type CurrencyPointerEnd,
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

function ArmoryScreenHeader({ onOpenMenu }: { onOpenMenu: Props["onOpenMenu"] }) {
  return (
    <div className="relative flex min-h-10 w-full items-center justify-center px-12">
      <ScreenHeader title="Armory" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <HamburgerTrigger onClick={onOpenMenu} label="Open armory menu" />
      </div>
    </div>
  );
}

interface WorkspaceGridProps {
  characterId: CharacterId;
  locked: boolean;
  loadout: GearLoadouts[CharacterId];
  inventoryById: Map<string, GearInstance>;
  editable: boolean;
  requiredCharacterId: CharacterId | null;
  draggedGear: GearInstance | null;
  draggedCurrencyId: CraftingCurrencyId | null;
  secondaryDragInstanceIds: string[];
  isDraggingActive: boolean;
  isCurrencyDraggingActive: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  characterInventory: GearInstance[];
  boardView: ReturnType<typeof buildArmoryBoardView>;
  inventoryBoardRef: React.RefObject<HTMLDivElement | null>;
  beginGearPointer: GearPointerStart;
  moveGearPointer: GearPointerMove;
  finishGearPointer: GearPointerEnd;
  handleGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  startSalvageTarget: (instance: GearInstance) => void;
  handleApplyCurrency: (instance: GearInstance) => void;
  abortGearDragIfDragging: (instanceId: string) => void;
  handleOpenTransferMenu: (instance: GearInstance, anchor: { x: number; y: number }) => void;
  onSpawnDevGear: ((characterId: CharacterId) => void) | undefined;
  handleSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  beginCurrencyPointer: CurrencyPointerStart;
  moveCurrencyPointer: CurrencyPointerMove;
  finishCurrencyPointer: CurrencyPointerEnd;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  onSortBoard: ((characterId: CharacterId) => void) | undefined;
  onToggleSalvageMode: () => void;
  setCursorPoint: React.Dispatch<React.SetStateAction<ArmoryCursorPoint | null>>;
}

function ArmoryWorkspaceGrid(props: WorkspaceGridProps) {
  return (
    <div className="armory-workspace mt-2 min-w-0 flex-1" data-testid="armory-workspace">
      <div
        className="armory-workspace-grid"
        onPointerMove={(event) => {
          if (props.activeCurrencyId) {
            props.setCursorPoint({ x: event.clientX, y: event.clientY });
          }
        }}
        onPointerLeave={() => props.setCursorPoint(null)}
      >
        <CharacterAndEquipmentPanel
          characterId={props.characterId}
          locked={props.locked}
          loadout={props.loadout}
          inventoryById={props.inventoryById}
          editable={props.editable}
          requiredCharacterId={props.requiredCharacterId}
          draggedGear={props.draggedGear}
          secondaryDragInstanceIds={props.secondaryDragInstanceIds}
          isDraggingActive={props.isDraggingActive}
          salvageMode={props.salvageMode}
          activeCurrencyId={props.activeCurrencyId}
          onGearPointerStart={props.beginGearPointer}
          onGearPointerMove={props.moveGearPointer}
          onGearPointerEnd={props.finishGearPointer}
          onGearDoubleClick={props.handleGearDoubleClick}
          onSalvage={props.startSalvageTarget}
          onApplyCurrency={props.handleApplyCurrency}
          onAbortGearDrag={props.abortGearDragIfDragging}
          onTransferRequest={props.handleOpenTransferMenu}
        />
        <InventoryPanel
          packedItems={props.boardView.packedInventory.items}
          packedCurrencies={props.boardView.packedCurrencies}
          occupiedRows={props.boardView.occupiedRows}
          editable={props.editable}
          draggedInstanceId={props.draggedGear?.instanceId ?? null}
          draggedCurrencyId={props.draggedCurrencyId}
          secondaryDragInstanceIds={props.secondaryDragInstanceIds}
          isDraggingActive={props.isDraggingActive || props.isCurrencyDraggingActive}
          boardRef={props.inventoryBoardRef}
          salvageMode={props.salvageMode}
          activeCurrencyId={props.activeCurrencyId}
          onSalvage={props.startSalvageTarget}
          hasSalvageableGear={
            props.editable && (props.characterInventory.length > 0 || Object.values(props.loadout).some(Boolean))
          }
          onToggleSalvageMode={props.onToggleSalvageMode}
          onSelectCurrency={props.handleSelectCurrency}
          {...(props.onSpawnDevGear
            ? {
                onSpawnDevGear: () => {
                  props.onSpawnDevGear!(props.characterId);
                },
              }
            : {})}
          onGearPointerStart={props.beginGearPointer}
          onGearPointerMove={props.moveGearPointer}
          onGearPointerEnd={props.finishGearPointer}
          onGearDoubleClick={props.handleGearDoubleClick}
          onCurrencyPointerStart={props.beginCurrencyPointer}
          onCurrencyPointerMove={props.moveCurrencyPointer}
          onCurrencyPointerEnd={props.finishCurrencyPointer}
          craftingCurrencies={props.craftingCurrencies}
          onApplyCurrency={props.handleApplyCurrency}
          onAbortGearDrag={props.abortGearDragIfDragging}
          onTransferRequest={props.handleOpenTransferMenu}
          {...(props.onSortBoard
            ? {
                onSortBoard: () => {
                  props.onSortBoard!(props.characterId);
                },
              }
            : {})}
        />
      </div>
    </div>
  );
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
        <ArmoryWorkspaceGrid
          characterId={characterId}
          locked={locked}
          loadout={loadout}
          inventoryById={inventoryById}
          editable={editable}
          requiredCharacterId={requiredCharacterId}
          draggedGear={draggedGear}
          draggedCurrencyId={draggedCurrencyId}
          secondaryDragInstanceIds={secondaryDragInstanceIds}
          isDraggingActive={isDraggingActive}
          isCurrencyDraggingActive={isCurrencyDraggingActive}
          salvageMode={salvageMode}
          activeCurrencyId={activeCurrencyId}
          characterInventory={characterInventory}
          boardView={boardView}
          inventoryBoardRef={inventoryBoardRef}
          beginGearPointer={beginGearPointer}
          moveGearPointer={moveGearPointer}
          finishGearPointer={finishGearPointer}
          handleGearDoubleClick={handleGearDoubleClick}
          startSalvageTarget={startSalvageTarget}
          handleApplyCurrency={handleApplyCurrency}
          abortGearDragIfDragging={abortGearDragIfDragging}
          handleOpenTransferMenu={handleOpenTransferMenu}
          onSpawnDevGear={onSpawnDevGear}
          handleSelectCurrency={handleSelectCurrency}
          beginCurrencyPointer={beginCurrencyPointer}
          moveCurrencyPointer={moveCurrencyPointer}
          finishCurrencyPointer={finishCurrencyPointer}
          craftingCurrencies={craftingCurrencies}
          onSortBoard={onSortBoard}
          onToggleSalvageMode={() => {
            setSalvageMode((current) => !current);
            setActiveCurrencyId(null);
          }}
          setCursorPoint={setCursorPoint}
        />
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
