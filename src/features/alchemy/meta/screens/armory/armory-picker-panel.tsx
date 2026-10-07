import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectionTitleClass } from "@/features/alchemy/shared/config";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, EquippedTrinkets, GearInstance, GearLoadout, GearLoadouts } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ArmoryInventoryControls } from "./armory-inventory-controls";
import type { ArmoryInventoryFilters } from "./armory-inventory-filtering";
import { ItemPickerGrid } from "./item-picker-grid";
import { SLOT_LABELS } from "./parts/slot-labels";
import { TrinketPickerGrid } from "./trinket-picker-grid";
import { FadeSlot } from "../../../shared/ui/use-fade";
import type { ArmorySortOption } from "./armory-ordering";

import type { ArmoryItemActions, ArmoryTargeting } from "./armory-screen-types";

interface ArmoryPickerPanelProps {
  reservedGear: Record<string, CharacterId>;
  reservedTrinkets: Record<string, CharacterId>;
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
  filters: ArmoryInventoryFilters;
  matchCount: number;
  totalCount: number;
  onFiltersChange: (filters: ArmoryInventoryFilters) => void;
  onBrowse: () => void;
  onSort: (option: ArmorySortOption) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  fillerCount: number;
  pagedGear: GearInstance[];
  pagedTrinkets: TrinketEntry[];
  placeholderIndex?: number | null | undefined;
  hiddenArtworkIds?: ReadonlySet<string>;
}

export function ArmoryPickerPanel({
  reservedGear,
  reservedTrinkets,
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
  filters,
  matchCount,
  totalCount,
  onFiltersChange,
  onBrowse,
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
  const paging = { page, totalPages, onPageChange, fillerCount, placeholderIndex, hiddenArtworkIds };
  return (
    <section
      data-testid="armory-right-panel"
      className="alchemy-shell relative flex min-h-0 min-w-0 flex-col rounded-shell-dialog border border-border/80 p-4"
    >
      <FadeSlot swapKey={selectedSlot} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative z-20 mb-3 flex min-h-11 w-full flex-wrap items-center justify-between gap-2">
          <h2 className={cn("font-sans", sectionTitleClass)}>{SLOT_LABELS[selectedSlot]}</h2>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <ArmoryInventoryControls
              key={`${characterId}:${selectedSlot}`}
              filters={filters}
              isTrinket={selectedSlot === "trinket"}
              onFiltersChange={onFiltersChange}
              onSort={onSort}
              onBrowse={onBrowse}
            />
            {onSpawnDevGear && editable && selectedSlot !== "trinket" ? (
              <div className="shrink-0">
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
        </div>
        {selectedSlot === "trinket" ? (
          <TrinketPickerGrid
            reservedTrinkets={reservedTrinkets}
            characterId={characterId}
            noMatches={totalCount > 0 && matchCount === 0}
            trinkets={ownedTrinkets}
            equippedTrinkets={equippedTrinkets}
            editable={editable}
            onEquip={actions.onEquipTrinket}
            onCombatLockedAttempt={actions.onCombatLockedAttempt}
            pageItems={pagedTrinkets}
            {...paging}
          />
        ) : (
          <ItemPickerGrid
            reservedGear={reservedGear}
            slot={selectedSlot}
            noMatches={totalCount > 0 && matchCount === 0}
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
            pageItems={pagedGear}
            {...paging}
          />
        )}
      </FadeSlot>
    </section>
  );
}
