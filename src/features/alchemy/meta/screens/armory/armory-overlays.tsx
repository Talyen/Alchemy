import { Sparkles } from "lucide-react";
import { getCraftingCurrencyDefinition, gearDefinitions, type GearInstance, type CraftingCurrencyId } from "@/lib/gear";
import { type CharacterId } from "@/lib/game-data";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { CurrencyDragVisualPortal } from "./armory-currency-drag-portal";
import { GearDragVisualPortal } from "./armory-drag-portal";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { ArmoryTransferMenu } from "./armory-transfer-menu";
import { playUISound } from "@/lib/audio";
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
  onSalvage: (instanceId: string) => void;
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
  onSalvage,
  onTransferGear,
  onClearSalvageTarget,
  onClearCurrencyDragState,
  onClearDragState,
  onClearSecondaryDragState,
  onCloseTransferMenu,
}: Props) {
  const dragDefinition = dragVisual ? gearDefinitions[dragVisual.instance.definitionId] : undefined;

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
            onSalvage(salvageTarget.instanceId);
            playUISound("salvage");
            onClearSalvageTarget();
          }}
        />
      ) : null}
      {currencyDragVisual ? (
        <CurrencyDragVisualPortal
          visual={currencyDragVisual}
          art={getCraftingCurrencyDefinition(currencyDragVisual.currencyId).art}
          count={craftingCurrencies[currencyDragVisual.currencyId] ?? 0}
          onComplete={onClearCurrencyDragState}
        />
      ) : null}
      {dragVisual && dragDefinition ? (
        <GearDragVisualPortal visual={dragVisual} art={dragDefinition.art} onComplete={onClearDragState} />
      ) : null}
      {secondaryDragVisuals.map((visual) => {
        const def = gearDefinitions[visual.instance.definitionId];
        return def ? (
          <GearDragVisualPortal
            key={visual.instance.instanceId}
            visual={visual}
            art={def.art}
            testId="armory-gear-swap-visual"
            onComplete={onClearSecondaryDragState}
          />
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
