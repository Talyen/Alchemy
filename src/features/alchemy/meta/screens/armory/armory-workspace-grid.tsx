import type { buildArmoryBoardView, CraftingCurrencyId, GearInstance, GearLoadouts } from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import { CharacterAndEquipmentPanel } from "./character-panel";
import { InventoryPanel } from "./inventory-panel";
import type { CurrencyPointerEnd, CurrencyPointerMove, CurrencyPointerStart } from "./use-armory-currency-drag";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "./use-armory-gear-drag";
import type { ArmoryCursorPoint } from "./armory-screen-types";

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

export function ArmoryWorkspaceGrid(props: WorkspaceGridProps) {
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
