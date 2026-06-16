import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  Crosshair,
  Flame,
  FlaskConical,
  Leaf,
  Lock,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import {
  characters,
  getRequiredPreviousCharacter,
  isCharacterUnlocked,
  keywordDefinitions,
  type CharacterId,
  type KeywordId,
} from "@/lib/game-data";
import {
  formatSalvageValue,
  INVENTORY_COLS,
  packInventoryWithPositions,
  resolveGearDefinition,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ConfirmationDialog, HamburgerTrigger, PageLayout, ScreenHeader, TabBar } from "../../shared/ui/shared-ui";
import { CharacterAndEquipmentPanel, InventoryPanel } from "./armory/armory-panels";
import { DOUBLE_CLICK_FLYOVER_MS, MAGNET_RELEASE_EASE_MS, useArmoryGearDrag } from "./armory/use-armory-gear-drag";
import { useArmoryInventoryPositions } from "./armory/use-armory-inventory-positions";
import "./armory/armory-screen.css";

const CHARACTER_ICONS: Record<CharacterId, LucideIcon> = {
  knight: Shield,
  rogue: Swords,
  wizard: WandSparkles,
  ranger: Crosshair,
  alchemist: FlaskConical,
  warlock: Flame,
  druid: Leaf,
  wildcard: Sparkles,
};

const CHARACTER_KEYWORDS: Record<CharacterId, KeywordId> = {
  knight: "forge",
  rogue: "bleed",
  wizard: "mana",
  ranger: "archery",
  alchemist: "poison",
  warlock: "leech",
  druid: "nature",
  wildcard: "wish",
};

type Props = {
  inventory: GearInstance[];
  loadouts: GearLoadouts;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => void;
};

export function ArmoryScreen({
  inventory,
  loadouts,
  finishedRunCharacters,
  browseOnly,
  onOpenMenu,
  onEquip,
  onUnequip,
  onSalvage,
}: Props) {
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const inventoryBoardRef = useRef<HTMLDivElement>(null);
  const [salvageTarget, setSalvageTarget] = useState<GearInstance | null>(null);
  const { savedPositions, handleMoveItem } = useArmoryInventoryPositions(inventory);

  const inventoryById = useMemo(() => new Map(inventory.map((item) => [item.instanceId, item])), [inventory]);
  const equippedInstanceIds = useMemo(
    () =>
      new Set(Object.values(loadouts).flatMap((characterLoadout) => Object.values(characterLoadout).filter(Boolean))),
    [loadouts],
  );
  const availableInventory = useMemo(
    () => inventory.filter((item) => !equippedInstanceIds.has(item.instanceId)),
    [equippedInstanceIds, inventory],
  );
  const loadout = loadouts[characterId];
  const requiredCharacterId = getRequiredPreviousCharacter(characterId);
  const locked = !isCharacterUnlocked(characterId, finishedRunCharacters);
  const editable = !browseOnly && !locked;
  const packedInventory = useMemo(
    () => packInventoryWithPositions(availableInventory, INVENTORY_COLS, savedPositions),
    [availableInventory, savedPositions],
  );

  const {
    draggedGear,
    dragVisual,
    isAnimating,
    isDraggingActive,
    beginGearPointer,
    moveGearPointer,
    finishGearPointer,
    handleGearDoubleClick,
    clearDragState,
  } = useArmoryGearDrag({
    characterId,
    editable,
    loadout,
    packedInventory,
    inventoryBoardRef,
    onEquip,
    onUnequip,
    onMoveItem: handleMoveItem,
  });

  const salvageDefinition = salvageTarget ? resolveGearDefinition(salvageTarget.definitionId) : undefined;
  const dragDefinition = dragVisual ? resolveGearDefinition(dragVisual.instance.definitionId) : undefined;

  return (
    <PageLayout>
      <div
        data-testid="armory-screen"
        className={cn(
          "alchemy-shell my-auto flex w-full max-w-[96rem] flex-1 flex-col rounded-shell-screen p-7 pb-1",
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
        <div
          data-testid="armory-character-selector"
          className="mt-4 w-full overflow-x-auto py-2 [scrollbar-width:none]"
        >
          <div className="mx-auto w-max min-w-full px-1">
            <TabBar
              tabs={(Object.keys(characters) as CharacterId[]).map((id) => {
                const isLocked = !isCharacterUnlocked(id, finishedRunCharacters);
                return {
                  id,
                  label: characters[id].name,
                  icon: isLocked ? Lock : CHARACTER_ICONS[id],
                  disabled: isLocked,
                  ...(isLocked ? {} : { iconClassName: keywordDefinitions[CHARACTER_KEYWORDS[id]].colorClass }),
                };
              })}
              activeTab={characterId}
              onSelectTab={setCharacterId}
            />
          </div>
        </div>
        <div className="armory-workspace mt-2 min-w-0 flex-1">
          <div className="armory-workspace-grid">
            <CharacterAndEquipmentPanel
              characterId={characterId}
              locked={locked}
              loadout={loadout}
              inventoryById={inventoryById}
              editable={editable}
              requiredCharacterId={requiredCharacterId}
              draggedGear={draggedGear}
              isDraggingActive={isDraggingActive}
              onGearPointerStart={beginGearPointer}
              onGearPointerMove={moveGearPointer}
              onGearPointerEnd={finishGearPointer}
              onGearDoubleClick={handleGearDoubleClick}
            />
            <InventoryPanel
              packedItems={packedInventory.items}
              occupiedRows={packedInventory.occupiedRows}
              loadouts={loadouts}
              editable={editable}
              browseOnly={browseOnly}
              draggedInstanceId={draggedGear?.instanceId ?? null}
              isDraggingActive={isDraggingActive}
              isAnimating={isAnimating}
              boardRef={inventoryBoardRef}
              onSalvage={setSalvageTarget}
              onGearPointerStart={beginGearPointer}
              onGearPointerMove={moveGearPointer}
              onGearPointerEnd={finishGearPointer}
              onGearDoubleClick={handleGearDoubleClick}
            />
          </div>
        </div>
        {salvageTarget && salvageDefinition ? (
          <ConfirmationDialog
            title="Salvage Gear?"
            description={`Permanently salvage ${salvageDefinition.title}. ${formatSalvageValue(salvageDefinition.salvageValue)}.`}
            confirmLabel="Salvage"
            onCancel={() => setSalvageTarget(null)}
            onConfirm={() => {
              onSalvage(salvageTarget.instanceId);
              setSalvageTarget(null);
            }}
          />
        ) : null}
        {dragVisual && dragDefinition
          ? createPortal(
              <motion.div
                data-testid="armory-gear-drag-visual"
                className="pointer-events-none fixed z-[120] overflow-hidden rounded-xl"
                initial={
                  dragVisual.flyover
                    ? {
                        x: 0,
                        y: 0,
                        width: dragVisual.source.width,
                        height: dragVisual.source.height,
                        boxShadow: "0 0px 0px 0px rgba(0,0,0,0)",
                      }
                    : {
                        boxShadow: "0 0px 0px 0px rgba(0,0,0,0)",
                      }
                }
                style={{
                  left: dragVisual.source.left,
                  top: dragVisual.source.top,
                  width: dragVisual.source.width,
                  height: dragVisual.source.height,
                  willChange: "transform,width,height",
                }}
                animate={{
                  x: dragVisual.rect.left - dragVisual.source.left,
                  y: dragVisual.rect.top - dragVisual.source.top,
                  width: dragVisual.rect.width,
                  height: dragVisual.rect.height,
                  scale: 1,
                  rotate: 0,
                  boxShadow:
                    dragVisual.settling || dragVisual.flyover
                      ? "0 0px 0px 0px rgba(0,0,0,0)"
                      : "0 25px 50px -12px rgba(0,0,0,0.5)",
                }}
                transition={{
                  boxShadow: { duration: 1, ease: "easeOut" },
                  default: dragVisual.flyover
                    ? { duration: DOUBLE_CLICK_FLYOVER_MS / 1000, ease: [0.22, 1, 0.36, 1] }
                    : dragVisual.releasing
                      ? { duration: MAGNET_RELEASE_EASE_MS / 1000, ease: [0.22, 1, 0.36, 1] }
                      : dragVisual.settling
                        ? { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 }
                        : { type: "spring", stiffness: 1000, damping: 50, mass: 0.15 },
                }}
                onAnimationComplete={() => {
                  if (dragVisual.settling || dragVisual.flyover) {
                    clearDragState();
                  }
                }}
              >
                <img src={dragDefinition.art} alt="" className="h-full w-full object-cover" />
              </motion.div>,
              document.body,
            )
          : null}
      </div>
    </PageLayout>
  );
}
