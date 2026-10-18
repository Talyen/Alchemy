import { useGameTranslation } from "@/components/use-game-translation";

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
import type { ArmorySortOption } from "./armory-ordering";

import type { ArmoryItemActions, ArmoryTargeting } from "./armory-screen-types";

interface ArmoryPickerPanelProps {
  reservedGear: Record<string, CharacterId>;
  reservedTrinkets: Record<string, CharacterId>;
  selectedSlot: ArmorySlot;
  characterId: CharacterId;
  equippedTrinkets: EquippedTrinkets;
  loadout: GearLoadout;
  loadouts: GearLoadouts;
  inventory: GearInstance[];
  targeting: ArmoryTargeting;
  actions: ArmoryItemActions;
  onSpawnDevGear: ((characterId: CharacterId) => void) | undefined;
  onSpawnDevTrinket?: (() => void) | undefined;
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
  equippedTrinkets,
  loadout,
  loadouts,
  inventory,
  targeting,
  actions,
  onSpawnDevGear,
  onSpawnDevTrinket,
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
  const i18n = useGameTranslation();
  const { editable, salvageMode, activeCurrencyId, craftingResult } = targeting;
  const paging = { page, totalPages, onPageChange, fillerCount, placeholderIndex, hiddenArtworkIds };
  return (
    <section
      data-testid="armory-right-panel"
      className="alchemy-shell relative flex min-h-0 min-w-0 flex-col rounded-shell-dialog border border-border/80 p-4"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative z-20 mb-3 flex min-h-11 w-full flex-wrap items-center justify-between gap-2">
          <h2 className={cn("font-sans", sectionTitleClass)}>{i18n.displayText(SLOT_LABELS[selectedSlot])}</h2>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <ArmoryInventoryControls
              key={`${characterId}:${selectedSlot}`}
              filters={filters}
              isTrinket={selectedSlot === "trinket"}
              onFiltersChange={onFiltersChange}
              onSort={onSort}
              onBrowse={onBrowse}
            />
            {editable && (selectedSlot === "trinket" ? onSpawnDevTrinket : onSpawnDevGear) ? (
              <div className="shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={i18n.displayText(
                    selectedSlot === "trinket"
                      ? i18n.text("ui.armory-picker-panel.d1", "Spawn random trinket")
                      : i18n.text("ui.armory-picker-panel.d2", "Spawn random gear"),
                  )}
                  onClick={() => {
                    if (selectedSlot === "trinket") {
                      onSpawnDevTrinket?.();
                    } else {
                      onSpawnDevGear?.(characterId);
                    }
                  }}
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
            noMatches={totalCount > 0 && matchCount === 0}
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
      </div>
    </section>
  );
}
