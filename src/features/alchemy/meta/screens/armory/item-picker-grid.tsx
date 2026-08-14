import { useState } from "react";
import {
  canApplyCraftingCurrency,
  gearDefinitions,
  getCraftingCurrencyDefinition,
  getGearInstanceTitle,
  isGearCompatibleWithLoadoutSlot,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import {
  cardSurfaceClass,
  collectionGridGapXClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
  gearArtFillClass,
} from "../../../shared/config";
import { GearDetailPopup } from "../../../shared/ui/gear-detail-popup";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { PaginationControls } from "../../../shared/ui/shared-ui";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "./targeting-highlight";

const INVENTORY_PAGE_SIZE = 6;

export function ItemPickerGrid({
  slot,
  characterId,
  items,
  loadout,
  inventory,
  siblingEquippedIds,
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
  inventory: GearInstance[];
  siblingEquippedIds: Set<string>;
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onEquip: (instance: GearInstance) => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const pageContext = `${characterId}:${slot}`;
  const [paging, setPaging] = useState({ context: pageContext, page: 0 });
  const page = paging.context === pageContext ? paging.page : 0;
  const totalPages = Math.max(1, Math.ceil(items.length / INVENTORY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * INVENTORY_PAGE_SIZE, (safePage + 1) * INVENTORY_PAGE_SIZE);
  const fillerCount = INVENTORY_PAGE_SIZE - pageItems.length;

  return (
    <section data-testid="armory-item-picker" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FadeSlot swapKey={`${characterId}-${slot}-${safePage}`} className="relative mt-2 w-full overflow-visible">
        {items.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-muted-foreground">
            No items for this slot
          </p>
        ) : null}
        <div className={cn("grid w-full grid-cols-3 grid-rows-2", collectionGridGapXClass, "gap-y-6")}>
          {pageItems.map((item) => {
            const definition = gearDefinitions[item.definitionId];
            const title = getGearInstanceTitle(item);
            const equippedElsewhere = siblingEquippedIds.has(item.instanceId);
            const loadoutLegal = definition
              ? isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory)
              : false;
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
                    disabled && "opacity-40",
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
                      <GearDetailPopup
                        definition={definition}
                        instance={item}
                        visible={visible}
                        triggerRef={triggerRef}
                      />
                    )}
                  />
                  {equippedElsewhere ? (
                    <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                      Equipped
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {Array.from({ length: fillerCount }).map((_, index) => (
            <div
              key={`armory-inventory-filler-${index}`}
              data-testid="armory-inventory-filler"
              className={cn(collectionGridTileWidthClass, gearArtAspectClass)}
              aria-hidden="true"
            />
          ))}
        </div>
      </FadeSlot>
      <div className="mt-auto flex justify-center">
        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={(nextPage) => setPaging({ context: pageContext, page: nextPage })}
          size="default"
          reserveSpace
          className="mt-0"
        />
      </div>
    </section>
  );
}
