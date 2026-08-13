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
import { cardSurfaceClass, collectionGridGapXClass, gearArtAspectClass } from "../../../shared/config";
import { GearDetailPopup } from "../../../shared/ui/gear-detail-popup";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { SLOT_LABELS } from "./parts/slot-labels";
import {
  SALVAGE_TARGET_RING,
  SALVAGE_TARGET_SHADOW,
  VALID_TARGET_RING,
  VALID_TARGET_SHADOW,
} from "./targeting-highlight";

export function itemsMatchingSlot(inventory: GearInstance[], slot: GearSlot): GearInstance[] {
  return inventory.filter((item) => {
    const definition = gearDefinitions[item.definitionId];
    return definition?.compatibleSlots.includes(slot) ?? false;
  });
}

export function ItemPickerGrid({
  slot,
  items,
  loadout,
  inventory,
  equippedInstanceId,
  siblingEquippedIds,
  editable,
  salvageMode,
  activeCurrencyId,
  onEquip,
  onUnequip,
  onSalvage,
  onApplyCurrency,
}: {
  slot: GearSlot;
  items: GearInstance[];
  loadout: GearLoadout;
  inventory: GearInstance[];
  equippedInstanceId: string | null;
  siblingEquippedIds: Set<string>;
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onEquip: (instance: GearInstance) => void;
  onUnequip: () => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}) {
  const slotLabel = SLOT_LABELS[slot];

  return (
    <section data-testid="armory-item-picker" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h2 className="text-center font-sans text-lg text-amber-100">{slotLabel}</h2>
      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No items for this slot</p>
      ) : (
        <FadeSlot
          swapKey={slot}
          className={cn("mt-4 grid w-full grid-cols-3 overflow-visible", collectionGridGapXClass, "gap-y-6")}
        >
          {items.map((item) => {
            const definition = gearDefinitions[item.definitionId];
            const title = getGearInstanceTitle(item);
            const equippedHere = item.instanceId === equippedInstanceId;
            const equippedElsewhere = siblingEquippedIds.has(item.instanceId);
            const loadoutLegal = definition
              ? equippedHere || isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventory)
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
                    selected={equippedHere}
                    interactive
                    ariaLabel={ariaLabel}
                    className={cn(cardSurfaceClass, gearArtAspectClass, "w-full")}
                    imageClassName="absolute inset-0 h-full w-full rounded-shell-hero object-cover"
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
                      if (equippedHere) {
                        onUnequip();
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
        </FadeSlot>
      )}
    </section>
  );
}
