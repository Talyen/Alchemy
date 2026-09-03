import {
  canApplyCraftingCurrency,
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
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
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
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "./targeting-highlight";
import { PagedPickerGrid, pickerFillerCount, pickerPageSlice, useContextPagedGrid } from "./paged-picker-grid";

export function ItemPickerGrid({
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
  onSalvage,
  onApplyCurrency,
}: {
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
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const pageContext = `${characterId}:${slot}`;
  const { safePage, totalPages, onPageChange } = useContextPagedGrid(pageContext, items.length);
  const pageItems = pickerPageSlice(items, safePage);
  const fillerCount = pickerFillerCount(pageItems.length);

  return (
    <PagedPickerGrid
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
        const definition = gearDefinitions[item.definitionId];
        const title = getGearInstanceTitle(item);
        const equippedCharacterId = findGearEquippedCharacter(loadouts, item.instanceId);
        const EquippedIcon = equippedCharacterId ? CHARACTER_ICONS[equippedCharacterId] : null;
        const keywordId = equippedCharacterId ? CHARACTER_KEYWORDS[equippedCharacterId] : null;
        const colorClass = keywordId ? keywordDefinitions[keywordId]?.colorClass : undefined;
        const loadoutLegal = definition ? isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory) : false;
        const shineColor = getAstralShineColors(item);
        const canCraft = Boolean(activeCurrencyId && canApplyCraftingCurrency(activeCurrencyId, item));
        const salvageable = salvageMode;
        const disabled = editable && !salvageMode && !activeCurrencyId && !loadoutLegal;
        let ariaLabel = title;
        if (activeCurrencyId && canCraft) {
          ariaLabel = `Apply ${getCraftingCurrencyDefinition(activeCurrencyId).displayName} to ${title}`;
        } else if (salvageable) {
          ariaLabel = `Salvage ${title}`;
        }

        return (
          <div key={item.instanceId} className="relative">
            <div
              data-testid="armory-inventory-item"
              data-gear-title={title}
              data-salvageable={salvageable ? "true" : undefined}
              className={cn(
                "relative",
                salvageable && [SALVAGE_TARGET_RING, SALVAGE_TARGET_SHADOW, "rounded-shell-hero"],
                activeCurrencyId && canCraft && [VALID_TARGET_RING, VALID_TARGET_SHADOW, "rounded-shell-hero"],
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
                ariaLabel={ariaLabel}
                className={cn(cardSurfaceClass, collectionGridTileWidthClass, gearArtAspectClass)}
                imageClassName={gearArtFillClass}
                shineColor={shineColor}
                onClick={() => {
                  if (!editable) return;
                  if (salvageable) {
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
                  <GearDetailPopup definition={definition} instance={item} visible={visible} triggerRef={triggerRef} />
                )}
              >
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
          </div>
        );
      })}
    </PagedPickerGrid>
  );
}
