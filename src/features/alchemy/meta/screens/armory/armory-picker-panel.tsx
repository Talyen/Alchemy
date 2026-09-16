import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { sectionTitleClass } from "@/features/alchemy/shared/config";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, EquippedTrinkets, GearInstance, GearLoadout, GearLoadouts } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ItemPickerGrid } from "./item-picker-grid";
import { SLOT_LABELS } from "./parts/slot-labels";
import { TrinketPickerGrid } from "./trinket-picker-grid";
import { FadeSlot } from "../../../shared/ui/use-fade";
import type { ArmorySortOption } from "./armory-ordering";

import type { GearCombatRestrictions } from "../../../shared/stores/gear-store";
import type { ArmoryItemActions, ArmoryTargeting } from "./armory-screen-types";

interface ArmoryPickerPanelProps {
  combatRestrictions: GearCombatRestrictions;
  selectedSlot: ArmorySlot;
  characterId: CharacterId;
  pickerItems: GearInstance[];
  ownedTrinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  loadout: GearLoadout;
  loadouts: GearLoadouts;
  inventory: GearInstance[];
  targeting: ArmoryTargeting;
  actions: ArmoryItemActions;
  onSpawnDevGear: ((characterId: CharacterId) => void) | undefined;
  onSort: (option: ArmorySortOption) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  fillerCount?: number;
  pagedGear?: GearInstance[];
  pagedTrinkets?: TrinketEntry[];
  placeholderIndex?: number | null;
  hiddenArtworkIds?: ReadonlySet<string>;
}

export function ArmoryPickerPanel({
  combatRestrictions,
  selectedSlot,
  characterId,
  pickerItems,
  ownedTrinkets,
  equippedTrinkets,
  loadout,
  loadouts,
  inventory,
  targeting,
  actions,
  onSpawnDevGear,
  onSort,
  page,
  totalPages,
  onPageChange,
  fillerCount,
  pagedGear,
  pagedTrinkets,
  placeholderIndex,
  hiddenArtworkIds,
}: ArmoryPickerPanelProps) {
  const { editable, salvageMode, activeCurrencyId, craftingResult } = targeting;
  return (
    <section
      data-testid="armory-right-panel"
      className="alchemy-shell relative flex min-h-0 min-w-0 flex-col rounded-shell-dialog border border-border/80 p-4"
    >
      <FadeSlot swapKey={selectedSlot} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-10 w-full items-center justify-center">
          <div className="absolute left-0">
            <Select value="" onValueChange={(val) => onSort(val as ArmorySortOption)}>
              <SelectTrigger
                aria-label="Sort inventory"
                className="h-8 w-auto min-w-[4.5rem] gap-1.5 border-border/80 bg-background/80 px-2.5 py-1 text-xs"
              >
                <span className="text-xs font-medium">Sort</span>
              </SelectTrigger>
              <SelectContent>
                {selectedSlot === "trinket" ? (
                  <SelectItem value="name">Name</SelectItem>
                ) : (
                  <>
                    <SelectItem value="rarity">Rarity</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <h2 className={cn("text-center font-sans", sectionTitleClass)}>{SLOT_LABELS[selectedSlot]}</h2>
          {onSpawnDevGear && editable && selectedSlot !== "trinket" ? (
            <div className="absolute right-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Spawn random gear"
                onClick={() => onSpawnDevGear(characterId)}
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
        {selectedSlot === "trinket" ? (
          <TrinketPickerGrid
            reservedTrinkets={combatRestrictions.trinkets}
            characterId={characterId}
            trinkets={ownedTrinkets}
            equippedTrinkets={equippedTrinkets}
            editable={editable}
            onEquip={actions.onEquipTrinket}
            onCombatLockedAttempt={actions.onCombatLockedAttempt}
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            fillerCount={fillerCount}
            pageItems={pagedTrinkets}
            placeholderIndex={placeholderIndex}
            hiddenArtworkIds={hiddenArtworkIds}
          />
        ) : (
          <ItemPickerGrid
            reservedGear={combatRestrictions.gear}
            slot={selectedSlot}
            characterId={characterId}
            items={pickerItems}
            loadout={loadout}
            loadouts={loadouts}
            inventory={inventory}
            editable={editable}
            salvageMode={salvageMode}
            activeCurrencyId={activeCurrencyId}
            onEquip={actions.onEquipGear}
            craftingResult={craftingResult}
            onSalvage={actions.onSalvage}
            onApplyCurrency={actions.onApplyCurrency}
            onCombatLockedAttempt={actions.onCombatLockedAttempt}
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            fillerCount={fillerCount}
            pageItems={pagedGear}
            placeholderIndex={placeholderIndex}
            hiddenArtworkIds={hiddenArtworkIds}
          />
        )}
      </FadeSlot>
    </section>
  );
}
