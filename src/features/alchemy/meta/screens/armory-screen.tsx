import { useCallback, useMemo, useRef, useState } from "react";
import {
  EMPTY_CRAFTING_CURRENCIES,
  buildArmoryBoardView,
  findGearInventoryOwner,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
  type InventoryPlacement,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  type CharacterId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { PageLayout } from "../../shared/ui/shared-ui";
import {
  useArmoryBoardDrag,
  ArmoryCharacterTabs,
  useArmoryTargetingEvents,
  ArmoryOverlays,
  type TransferMenuState,
  ArmoryScreenHeader,
  ArmoryWorkspaceGrid,
  useArmoryResetEffects,
  type ArmoryCursorPoint,
  type ArmoryScreenProps,
} from "./armory";
import { applyCurrencyToGear, equipWithArmorySwap, resetArmoryTargeting } from "./armory/armory-screen-actions";
import "./armory/armory-screen.css";

function blurActiveArmoryElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function buildTransferMenuState({
  inventories,
  instance,
  anchor,
  finishedRunCharacters,
}: {
  inventories: Record<CharacterId, GearInstance[]>;
  instance: GearInstance;
  anchor: { x: number; y: number };
  finishedRunCharacters: CharacterId[];
}): TransferMenuState | null {
  const owner = findGearInventoryOwner(inventories, instance.instanceId);
  if (!owner) return null;
  const recipients = (Object.keys(characters) as CharacterId[])
    .filter((id) => id !== owner)
    .filter((id) => isCharacterUnlocked(id, finishedRunCharacters));
  if (recipients.length === 0) return null;
  return {
    instanceId: instance.instanceId,
    sourceCharacterId: owner,
    anchor,
  };
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
}: ArmoryScreenProps) {
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
      equipWithArmorySwap({
        targetCharacterId,
        slot,
        instance,
        options,
        loadouts,
        inventoryById,
        packedItems: boardView.packedInventory.items,
        onEquip,
      });
    },
    [boardView.packedInventory.items, inventoryById, loadouts, onEquip],
  );
  const {
    draggedGear,
    draggedCurrencyId,
    gearDragVisual,
    currencyDragVisual,
    secondaryDragVisuals,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
    completeDragAnimation,
    clearSecondaryDragState,
    abortGearDragIfDragging,
    beginCurrencyPointer,
    moveCurrencyPointer,
    finishCurrencyPointer,
  } = useArmoryBoardDrag({
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
    onMoveCurrency: handleMoveCurrency,
  });
  const secondaryDragInstanceIds = secondaryDragVisuals.flatMap((v) => (v.instance ? [v.instance.instanceId] : []));
  const clearTargeting = useCallback(() => {
    resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setCursorPoint });
    blurActiveArmoryElement();
  }, []);
  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget,
    clearTargeting,
  });
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
      const menu = buildTransferMenuState({ inventories, instance, anchor, finishedRunCharacters });
      if (menu) setTransferMenu(menu);
    },
    [finishedRunCharacters, inventories],
  );
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
          dragVisual={gearDragVisual}
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
          onClearDragState={clearDragState}
          onCompleteDragAnimation={completeDragAnimation}
          onClearSecondaryDragState={clearSecondaryDragState}
          onCloseTransferMenu={() => setTransferMenu(null)}
        />
      </div>
    </PageLayout>
  );
}
