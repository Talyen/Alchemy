import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CraftingResult } from "./crafting-result";
import { GearProtectionButton } from "./parts/gear-protection-button";
import {
  gearDefinitions,
  getAstralShineColors,
  getGearInstanceTitle,
  isGearCompatibleWithLoadoutSlot,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";
import { keywordDefinitions, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import {
  cardSurfaceClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
  gearArtFillClass,
} from "../../../shared/config";
import { GearDetailPopup } from "../../../shared/ui/gear-detail-popup";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { CHARACTER_ICONS, CHARACTER_KEYWORDS } from "./armory-character-tabs";
import { targetingRingClass } from "./targeting-highlight";
import { getArmoryTargetState, reservedReasonFor } from "./armory-item-state";
import { CraftingFlash, ReservedLock } from "./parts/armory-item-chrome";
import { ArmoryPagedGrid } from "./paged-picker-grid";

export function ItemPickerGrid({
  reservedGear,
  slot,
  characterId,
  items,
  loadout,
  loadouts,
  inventory,
  editable,
  salvageMode,
  activeCurrencyId,
  onEquip,
  onSetProtected,
  craftingResult,
  onSalvage,
  onApplyCurrency,
}: {
  reservedGear: Record<string, CharacterId>;
  slot: GearSlot;
  characterId: string;
  items: GearInstance[];
  loadout: GearLoadout;
  loadouts: GearLoadouts;
  inventory: GearInstance[];
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onEquip: (instance: GearInstance) => void;
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
  craftingResult: CraftingResult | null;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const reducedMotion = useReducedMotion();
  const equippedBy = useMemo(() => {
    const byInstance = new Map<string, CharacterId>();
    for (const [ownerId, ownerLoadout] of Object.entries(loadouts) as Array<[CharacterId, GearLoadout]>) {
      for (const equippedId of Object.values(ownerLoadout)) {
        if (equippedId) byInstance.set(equippedId, ownerId);
      }
    }
    return byInstance;
  }, [loadouts]);

  return (
    <ArmoryPagedGrid
      items={items}
      selectedId={loadout[slot]}
      context={`${characterId}:${slot}`}
      testId="armory-item-picker"
      swapKey={slot}
      fillerTestId="armory-inventory-filler"
      renderItem={(item) => {
        const reservedBy = reservedGear[item.instanceId];
        const reservationReason = reservedReasonFor(reservedBy ?? null);
        const definition = gearDefinitions[item.definitionId];
        const title = getGearInstanceTitle(item);
        const equippedCharacterId = equippedBy.get(item.instanceId) ?? null;
        const EquippedIcon = equippedCharacterId ? CHARACTER_ICONS[equippedCharacterId] : null;
        const keywordId = equippedCharacterId ? CHARACTER_KEYWORDS[equippedCharacterId] : null;
        const colorClass = keywordId ? keywordDefinitions[keywordId]?.colorClass : undefined;
        const loadoutLegal = definition ? isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory) : false;
        const shineColor = getAstralShineColors(item);
        const target = getArmoryTargetState({ instance: item, salvageMode, activeCurrencyId, reservedBy });
        const { salvageable, blockedReason, mode, targetAriaLabel } = target;
        const disabled = editable && !salvageMode && !activeCurrencyId && !loadoutLegal;
        const ariaLabel = targetAriaLabel ?? title;

        return (
          <motion.div
            key={item.instanceId}
            layout={reducedMotion ? false : "position"}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <div
              data-testid="armory-inventory-item"
              data-gear-title={title}
              data-salvageable={salvageable ? "true" : undefined}
              className={cn("relative", targetingRingClass(mode), disabled && "opacity-50")}
              title={disabled ? "Incompatible with the current loadout" : undefined}
            >
              <InteractiveArtTile
                id={item.instanceId}
                interactionKey="armory"
                title={title}
                art={definition?.art}
                as="button"
                interactive
                ariaLabel={reservationReason ? `${title}. ${reservationReason}` : ariaLabel}
                ariaDisabled={!editable || Boolean(reservedBy) || disabled}
                className={cn(cardSurfaceClass, collectionGridTileWidthClass, gearArtAspectClass)}
                imageClassName={gearArtFillClass}
                shineColor={shineColor}
                onClick={() => {
                  if (!editable || reservedBy) return;
                  if (salvageMode) {
                    onSalvage(item);
                    return;
                  }
                  if (activeCurrencyId) {
                    onApplyCurrency(item);
                    return;
                  }
                  if (!loadoutLegal) {
                    playUISound("error");
                    return;
                  }
                  onEquip(item);
                }}
                popup={({ visible, triggerRef }) => (
                  <GearDetailPopup
                    definition={definition}
                    instance={item}
                    visible={visible}
                    triggerRef={triggerRef}
                    notice={blockedReason ?? undefined}
                  />
                )}
              >
                {reservedBy && reservationReason ? <ReservedLock /> : null}
                {EquippedIcon ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-md backdrop-blur-md",
                      colorClass,
                    )}
                  >
                    <EquippedIcon className="h-7 w-7" />
                  </span>
                ) : null}
              </InteractiveArtTile>
            </div>
            <CraftingFlash result={craftingResult} instanceId={item.instanceId} />
            <GearProtectionButton instance={item} editable={editable && !reservedBy} onSetProtected={onSetProtected} />
          </motion.div>
        );
      }}
    />
  );
}
