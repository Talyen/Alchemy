import { Lock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { CraftingResult } from "./crafting-result";
import { GearProtectionButton } from "./parts/gear-protection-button";
import {
  canApplyCraftingCurrency,
  craftingCurrencyBlockedReason,
  findGearEquippedCharacter,
  gearDefinitions,
  getAstralShineColors,
  getCraftingCurrencyDefinition,
  getGearInstanceTitle,
  isGearCompatibleWithLoadoutSlot,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearLoadouts,
  type GearSlot,
} from "@/lib/gear";
import { keywordDefinitions, characters, type CharacterId } from "@/features/alchemy/shared/config/game-data-catalog";
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
import { PagedPickerGrid, useArmoryPickerPage } from "./paged-picker-grid";

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
  const pageContext = `${characterId}:${slot}`;
  const { grid, pageItems, fillerCount, safePage, totalPages, onPageChange } = useArmoryPickerPage(
    pageContext,
    items,
    items.findIndex((item) => item.instanceId === loadout[slot]),
  );

  return (
    <PagedPickerGrid
      grid={grid}
      testId="armory-item-picker"
      swapKey={slot}
      isEmpty={items.length === 0}
      safePage={safePage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={fillerCount}
      fillerClassName={cn(collectionGridTileWidthClass, gearArtAspectClass)}
      fillerTestId="armory-inventory-filler"
    >
      {pageItems.map((item) => {
        const reservedBy = reservedGear[item.instanceId];
        const reservationReason = reservedBy
          ? `Reserved for ${characters[reservedBy].name} until their battle ends.`
          : null;
        const definition = gearDefinitions[item.definitionId];
        const title = getGearInstanceTitle(item);
        const equippedCharacterId = findGearEquippedCharacter(loadouts, item.instanceId);
        const EquippedIcon = equippedCharacterId ? CHARACTER_ICONS[equippedCharacterId] : null;
        const keywordId = equippedCharacterId ? CHARACTER_KEYWORDS[equippedCharacterId] : null;
        const colorClass = keywordId ? keywordDefinitions[keywordId]?.colorClass : undefined;
        const loadoutLegal = definition ? isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory) : false;
        const shineColor = getAstralShineColors(item);
        const canCraft = Boolean(!reservedBy && activeCurrencyId && canApplyCraftingCurrency(activeCurrencyId, item));
        const salvageable = !reservedBy && salvageMode && !item.protected;
        const blockedReason =
          reservationReason ??
          (activeCurrencyId
            ? craftingCurrencyBlockedReason(activeCurrencyId, item)
            : salvageMode && item.protected
              ? "Unlock this item before salvaging."
              : null);
        const disabled = editable && !salvageMode && !activeCurrencyId && !loadoutLegal;
        let ariaLabel = title;
        if (activeCurrencyId && canCraft) {
          ariaLabel = `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${title}`;
        } else if (salvageable) {
          ariaLabel = `Salvage ${title}`;
        }

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
              className={cn(
                "relative",
                targetingRingClass(salvageable ? "salvage" : null),
                targetingRingClass(activeCurrencyId && canCraft ? "currency" : null),
                disabled && "opacity-50",
              )}
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
                {reservedBy ? (
                  <Lock
                    aria-label={reservationReason ?? undefined}
                    className="absolute bottom-3 left-3 z-10 h-6 w-6 text-amber-200"
                  />
                ) : null}
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
            {craftingResult?.before.instanceId === item.instanceId ? (
              <span
                key={JSON.stringify(craftingResult)}
                aria-hidden="true"
                className="armory-item-feedback pointer-events-none absolute inset-0 z-20 rounded-shell-hero"
              />
            ) : null}
            <GearProtectionButton instance={item} editable={editable && !reservedBy} onSetProtected={onSetProtected} />
          </motion.div>
        );
      })}
    </PagedPickerGrid>
  );
}
