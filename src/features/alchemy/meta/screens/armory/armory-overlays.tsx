import { Sparkles } from "lucide-react";
import { getCraftingCurrencyDefinition, gearDefinitions, type GearInstance, type CraftingCurrencyId } from "@/lib/gear";
import { type CharacterId } from "@/lib/game-data";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { DragVisualPortal } from "./armory-drag-visual-portal";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { ArmoryTransferMenu } from "./armory-transfer-menu";
import { playUISound } from "@/lib/audio";
import type { DragRect } from "./use-board-drag";
import type { GearDragVisual } from "./use-armory-gear-drag";
import type { CurrencyDragVisual } from "./use-armory-currency-drag";
import type { TransferMenuState } from "./armory-targeting-state";

type Props = {
  salvageTarget: GearInstance | null;
  currencyDragVisual: CurrencyDragVisual | null;
  dragVisual: GearDragVisual | null;
  secondaryDragVisuals: GearDragVisual[];
  activeCurrencyId: CraftingCurrencyId | null;
  cursorPoint: { x: number; y: number } | null;
  transferMenu: TransferMenuState;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  editable: boolean;
  carriedCurrencyId: CraftingCurrencyId | null;
  carriedCurrencyVisual: DragRect | null;
  onSalvage: (instanceId: string) => boolean;
  onTransferGear: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onClearSalvageTarget: () => void;
  onClearCurrencyDragState: () => void;
  onClearDragState: () => void;
  onClearSecondaryDragState: () => void;
  onCloseTransferMenu: () => void;
};

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
  carriedCurrencyId,
  carriedCurrencyVisual,
  onSalvage,
  onTransferGear,
  onClearSalvageTarget,
  onClearCurrencyDragState,
  onClearDragState,
  onClearSecondaryDragState,
  onCloseTransferMenu,
}: Props) {
  const dragDefinition = dragVisual?.instance ? gearDefinitions[dragVisual.instance.definitionId] : undefined;

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
          onComplete={onClearCurrencyDragState}
        >
          <div className="relative h-full w-full">
            <img
              src={getCraftingCurrencyDefinition(currencyDragVisual.currencyId).art}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute top-1 left-1 text-xs font-bold leading-none text-stone-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {craftingCurrencies[currencyDragVisual.currencyId] ?? 0}
            </span>
          </div>
        </DragVisualPortal>
      ) : null}
      {dragVisual && dragDefinition ? (
        <DragVisualPortal visual={dragVisual} className="bg-background/60" onComplete={onClearDragState}>
          <img
            src={dragDefinition.art}
            alt=""
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
          />
        </DragVisualPortal>
      ) : null}
      {secondaryDragVisuals.map((visual) => {
        if (!visual.instance) return null;
        const def = gearDefinitions[visual.instance.definitionId];
        return def ? (
          <DragVisualPortal
            key={visual.instance.instanceId}
            visual={visual}
            testId="armory-gear-swap-visual"
            className="bg-background/60"
            onComplete={onClearSecondaryDragState}
          >
            <img
              src={def.art}
              alt=""
              className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
            />
          </DragVisualPortal>
        ) : null;
      })}
      {carriedCurrencyId && carriedCurrencyVisual ? (
        <DragVisualPortal
          visual={{ source: carriedCurrencyVisual, rect: carriedCurrencyVisual }}
          testId="armory-currency-carry-visual"
          className="bg-background/60"
          onComplete={() => {}}
        >
          <img
            src={getCraftingCurrencyDefinition(carriedCurrencyId).art}
            alt=""
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
          />
        </DragVisualPortal>
      ) : null}
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
