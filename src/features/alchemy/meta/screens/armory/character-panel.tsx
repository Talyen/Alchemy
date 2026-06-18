import { memo, useEffect } from "react";
import { Lock } from "lucide-react";
import { characters, characterArt, type CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearLoadouts, GearSlot } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { SlotButton } from "./parts/slot-button";
import { EQUIP_SLOTS, equipmentSlotStyle } from "./parts/grid-styles";
import type { GearDragOrigin, GearPointerEnd, GearPointerMove, GearPointerStart } from "./use-armory-gear-drag";

export const CharacterAndEquipmentPanel = memo(function CharacterAndEquipmentPanel({
  characterId,
  locked,
  loadout,
  inventoryById,
  editable,
  requiredCharacterId,
  draggedGear,
  secondaryDragInstanceId = null,
  isDraggingActive,
  salvageMode,
  activeCurrencyId,
  onGearPointerStart,
  onGearPointerMove,
  onGearPointerEnd,
  onGearDoubleClick,
  onSalvage,
  onApplyCurrency,
  onAbortGearDrag,
}: {
  characterId: CharacterId;
  locked: boolean;
  loadout: GearLoadouts[CharacterId];
  inventoryById: Map<string, GearInstance>;
  editable: boolean;
  requiredCharacterId: CharacterId | null;
  draggedGear?: GearInstance | null;
  secondaryDragInstanceId?: string | null;
  isDraggingActive: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onGearPointerStart: GearPointerStart;
  onGearPointerMove: GearPointerMove;
  onGearPointerEnd: GearPointerEnd;
  onGearDoubleClick: (instance: GearInstance, origin: GearDragOrigin, rect: DOMRect) => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
  onAbortGearDrag: (instanceId: string) => void;
}) {
  const { onHoverStart, shimmerActive, shimmerToken } = useInteractiveCard("armory", characterId);

  useEffect(() => {
    onHoverStart();
  }, [characterId, onHoverStart]);

  return (
    <section
      data-testid="armory-left-panel"
      className="alchemy-shell relative flex min-w-0 flex-col md:flex-row items-center justify-center gap-6 rounded-shell-dialog border border-border/80 p-5"
    >
      <div data-testid="armory-character-panel" className="flex min-w-0 flex-col items-center justify-center px-4 py-2">
        <h2 className="text-center font-display text-lg text-amber-100">{characters[characterId].name}</h2>
        <TiltSurface
          testId="armory-character-art-container"
          tiltEnabled={!locked}
          className={cn(
            "relative mt-3 aspect-[3/4] shrink-0 overflow-hidden rounded-shell-hero bg-black",
            "armory-character-art-container",
          )}
          shimmerActive={locked ? false : shimmerActive}
          shimmerToken={locked ? undefined : shimmerToken}
          shimmerRounded="rounded-shell-hero"
          onMouseEnter={onHoverStart}
        >
          <img
            src={characterArt[characterId]}
            alt={characters[characterId].name}
            className={cn("h-full w-full object-cover", locked && "grayscale opacity-40")}
          />
        </TiltSurface>
      </div>

      <div data-testid="armory-equipment-panel" className="relative flex min-w-0 flex-col items-center p-2">
        <h2 className="text-center font-display text-lg text-amber-100">Equipment</h2>
        <div data-testid="armory-equipment-board" className="armory-equipment-board relative mt-4 aspect-[6/7]">
          {EQUIP_SLOTS.map((slot: GearSlot) => {
            const instanceId = loadout[slot];
            return (
              <div key={slot} className="absolute min-h-0 min-w-0" style={equipmentSlotStyle(slot)}>
                <SlotButton
                  slot={slot}
                  instance={instanceId ? inventoryById.get(instanceId) : undefined}
                  editable={editable}
                  draggedGear={draggedGear}
                  secondaryDragInstanceId={secondaryDragInstanceId}
                  isDraggingActive={isDraggingActive}
                  salvageMode={salvageMode}
                  activeCurrencyId={activeCurrencyId}
                  onGearPointerStart={onGearPointerStart}
                  onGearPointerMove={onGearPointerMove}
                  onGearPointerEnd={onGearPointerEnd}
                  onGearDoubleClick={onGearDoubleClick}
                  onAbortGearDrag={onAbortGearDrag}
                  onSalvage={() =>
                    instanceId && inventoryById.get(instanceId) && onSalvage(inventoryById.get(instanceId)!)
                  }
                  onApplyCurrency={() =>
                    instanceId && inventoryById.get(instanceId) && onApplyCurrency(inventoryById.get(instanceId)!)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {locked && requiredCharacterId ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-shell-dialog bg-black/70 p-5">
          <div className="max-w-xs text-center">
            <Lock className="mx-auto h-8 w-8" />
            <p className="mt-2 font-semibold">Finish a Run as the {characters[requiredCharacterId].name} to unlock</p>
          </div>
        </div>
      ) : null}
    </section>
  );
});
