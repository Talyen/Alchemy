import type { RefObject } from "react";
import { Lock } from "lucide-react";
import type { TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, CraftingCurrencyId, GearInstance, GearLoadout, GearSlot } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, sectionTitleClass } from "../../../shared/config";
import { renderUnlockMessage } from "../../../shared/ui/unlock-text";
import type { ArmoryTargeting } from "./armory-screen-types";
import { CraftingStrip } from "./parts/crafting-strip";
import { EquipmentSlotButton } from "./parts/equipment-slot-button";
import { EQUIP_SLOTS } from "./parts/slot-labels";
import { TrinketSlotButton } from "./parts/trinket-slot-button";

interface ArmoryEquipmentPanelProps {
  loadout: GearLoadout;
  inventoryById: ReadonlyMap<string, GearInstance>;
  equippedTrinket: TrinketEntry | undefined;
  selectedSlot: ArmorySlot;
  targeting: ArmoryTargeting;
  hiddenArtworkSlots: Partial<Record<ArmorySlot, boolean>>;
  salvageButtonRef: RefObject<HTMLButtonElement | null>;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  hasSalvageableGear: boolean;
  lockedCharacterName: string | null;
  onSelectSlot: (slot: ArmorySlot) => void;
  onUnequipSlot: (slot: GearSlot) => void;
  onUnequipTrinket: () => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
  onCombatLockedAttempt: () => void;
  onSelectCurrency: (currencyId: CraftingCurrencyId) => void;
  onToggleSalvageMode: () => void;
}

export function ArmoryEquipmentPanel({
  loadout,
  inventoryById,
  equippedTrinket,
  selectedSlot,
  targeting,
  hiddenArtworkSlots,
  salvageButtonRef,
  craftingCurrencies,
  hasSalvageableGear,
  lockedCharacterName,
  onSelectSlot,
  onUnequipSlot,
  onUnequipTrinket,
  onSalvage,
  onApplyCurrency,
  onCombatLockedAttempt,
  onSelectCurrency,
  onToggleSalvageMode,
}: ArmoryEquipmentPanelProps) {
  const { editable, salvageMode, activeCurrencyId, craftingResult } = targeting;
  return (
    <section
      data-testid="armory-left-panel"
      className="alchemy-shell relative flex min-w-0 flex-col items-center rounded-shell-dialog border border-border/80 p-4"
    >
      <div className="relative flex min-h-10 w-full items-center justify-center">
        <h2 className={cn("text-center font-sans", sectionTitleClass)}>Equipment</h2>
      </div>
      <div
        data-testid="armory-equipment-board"
        className={cn("mt-2 grid w-full grid-cols-3", collectionGridGapXClass, "gap-y-6")}
      >
        {EQUIP_SLOTS.map((slot) => {
          if (slot === "trinket") {
            return (
              <TrinketSlotButton
                key={slot}
                trinket={equippedTrinket}
                selected={selectedSlot === slot}
                editable={editable}
                isArtHidden={Boolean(hiddenArtworkSlots.trinket)}
                onSelect={() => onSelectSlot(slot)}
                onUnequip={onUnequipTrinket}
                onCombatLockedAttempt={onCombatLockedAttempt}
              />
            );
          }
          const instanceId = loadout[slot];
          const instance = instanceId ? inventoryById.get(instanceId) : undefined;
          return (
            <EquipmentSlotButton
              key={slot}
              slot={slot}
              instance={instance}
              selected={selectedSlot === slot}
              editable={editable}
              salvageMode={salvageMode}
              activeCurrencyId={activeCurrencyId}
              isArtHidden={Boolean(hiddenArtworkSlots[slot])}
              onSelect={onSelectSlot}
              onUnequip={onUnequipSlot}
              craftingResult={craftingResult}
              onSalvage={onSalvage}
              onApplyCurrency={onApplyCurrency}
              onCombatLockedAttempt={onCombatLockedAttempt}
            />
          );
        })}
      </div>
      <CraftingStrip
        salvageButtonRef={salvageButtonRef}
        craftingCurrencies={craftingCurrencies}
        activeCurrencyId={activeCurrencyId}
        salvageMode={salvageMode}
        editable={editable}
        hasSalvageableGear={hasSalvageableGear}
        onSelectCurrency={onSelectCurrency}
        onToggleSalvageMode={onToggleSalvageMode}
      />
      {lockedCharacterName ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-shell-dialog bg-black/70 p-5">
          <div className="max-w-xs text-center">
            <Lock className="mx-auto h-8 w-8" />
            <p className="mt-2 font-semibold">
              {renderUnlockMessage(`Finish a Run as the ${lockedCharacterName} to unlock`)}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
