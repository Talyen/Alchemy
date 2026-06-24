import { Sparkles } from "lucide-react";
import {
  gearDefinitions,
  gearInstanceRarity,
  getCraftingCurrencyDefinition,
  getGearInstanceShineColors,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { ShineBorder } from "@/components/ui/shine-border";
import { type CharacterId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { DragVisualPortal } from "./armory-drag-visual-portal";
import { GearSlotArt } from "./parts/gear-slot-art";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { ArmoryTransferMenu, type TransferMenuState } from "./armory-transfer-menu";
import { playUISound } from "@/lib/audio";
import type { GearDragVisual } from "./use-armory-gear-drag";
import type { CurrencyDragVisual } from "./use-armory-currency-drag";

interface Props {
  salvageTarget: GearInstance | null;
  currencyDragVisual: CurrencyDragVisual | null;
  dragVisual: GearDragVisual | null;
  secondaryDragVisuals: GearDragVisual[];
  activeCurrencyId: CraftingCurrencyId | null;
  cursorPoint: { x: number; y: number } | null;
  transferMenu: TransferMenuState | null;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  editable: boolean;
  onSalvage: (instanceId: string) => boolean;
  onTransferGear: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onClearSalvageTarget: () => void;
  onClearCurrencyDragState: () => void;
  onClearDragState: () => void;
  onClearSecondaryDragState: () => void;
  onCloseTransferMenu: () => void;
}

export function ArmoryOverlays({
  salvageTarget,
  currencyDragVisual,
  dragVisual,
  secondaryDragVisuals,
  activeCurrencyId,
  cursorPoint,
  transferMenu,
  craftingCurrencies,
  finishedRunCharacters,
  editable,
  onSalvage,
  onTransferGear,
  onClearSalvageTarget,
  onClearCurrencyDragState,
  onClearDragState,
  onClearSecondaryDragState,
  onCloseTransferMenu,
}: Props) {
  const dragDefinition = dragVisual?.instance ? gearDefinitions[dragVisual.instance.definitionId] : undefined;
  const dragIsAstral = dragVisual?.instance ? gearInstanceRarity(dragVisual.instance) === "astral" : false;
  const dragShineColors = dragVisual?.instance ? getGearInstanceShineColors(dragVisual.instance) : [];

  return (
    <>
      {salvageTarget ? (
        <ConfirmationDialog
          title={
            <>
              Salvage <GearItemTitle instance={salvageTarget} />?
            </>
          }
          description="Salvaging items yields crafting materials"
          confirmLabel="Salvage"
          icon={Sparkles}
          dimBackground={false}
          dismissOnBackdrop={false}
          onCancel={onClearSalvageTarget}
          onConfirm={() => {
            if (!editable) {
              onClearSalvageTarget();
              return;
            }
            const ok = onSalvage(salvageTarget.instanceId);
            if (ok) {
              playUISound("salvage");
              onClearSalvageTarget();
            } else {
              playUISound("error");
            }
          }}
        />
      ) : null}
      {currencyDragVisual ? (
        <DragVisualPortal
          visual={currencyDragVisual}
          testId="armory-currency-drag-visual"
          className="border border-stone-500/40"
          onComplete={onClearCurrencyDragState}
        >
          <div className="relative h-full w-full">
            <img
              src={getCraftingCurrencyDefinition(currencyDragVisual.currencyId).art}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute top-1 left-1 text-xs font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {craftingCurrencies[currencyDragVisual.currencyId]}
            </span>
          </div>
        </DragVisualPortal>
      ) : null}
      {dragVisual && dragDefinition && dragVisual.flyover && dragVisual.destination?.kind === "equipment" ? (
        <DragVisualPortal
          visual={dragVisual}
          onComplete={onClearDragState}
          {...(!dragIsAstral ? { className: "border border-stone-500/40" } : {})}
        >
          <GearSlotArt definition={dragDefinition} slot={dragVisual.destination.slot as GearSlot} />
          {dragShineColors.length > 0 ? <ShineBorder shineColor={dragShineColors} borderWidth={1} /> : null}
        </DragVisualPortal>
      ) : dragVisual && dragDefinition ? (
        <DragVisualPortal
          visual={dragVisual}
          className={cn("bg-background/60", !dragIsAstral && "border border-stone-500/40")}
          onComplete={onClearDragState}
        >
          <img
            src={dragDefinition.art}
            alt=""
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
          />
          {dragShineColors.length > 0 ? <ShineBorder shineColor={dragShineColors} borderWidth={1} /> : null}
        </DragVisualPortal>
      ) : null}
      {secondaryDragVisuals.map((visual) => {
        if (!visual.instance) return null;
        const def = gearDefinitions[visual.instance.definitionId];
        const secIsAstral = gearInstanceRarity(visual.instance) === "astral";
        const secShineColors = getGearInstanceShineColors(visual.instance);
        return def ? (
          <DragVisualPortal
            key={visual.instance.instanceId}
            visual={visual}
            testId="armory-gear-swap-visual"
            className={cn("bg-background/60", !secIsAstral && "border border-stone-500/40")}
            onComplete={onClearSecondaryDragState}
          >
            <img
              src={def.art}
              alt=""
              className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
            />
            {secShineColors.length > 0 ? <ShineBorder shineColor={secShineColors} borderWidth={1} /> : null}
          </DragVisualPortal>
        ) : null;
      })}
      <ArmoryCurrencyCursor activeCurrencyId={activeCurrencyId} cursorPoint={cursorPoint} />
      {transferMenu ? (
        <ArmoryTransferMenu
          transferMenu={transferMenu}
          finishedRunCharacters={finishedRunCharacters}
          onTransferGear={onTransferGear}
          onClose={onCloseTransferMenu}
        />
      ) : null}
    </>
  );
}
