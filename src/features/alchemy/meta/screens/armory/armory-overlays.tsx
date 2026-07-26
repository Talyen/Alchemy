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
import { CURRENCY_COUNT_LABEL_CLASS } from "./parts/currency-styles";
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

function SalvageDialog({
  target,
  editable,
  onSalvage,
  onClear,
}: {
  target: GearInstance;
  editable: boolean;
  onSalvage: (id: string) => boolean;
  onClear: () => void;
}) {
  return (
    <ConfirmationDialog
      title={
        <>
          <span>Salvage </span>
          <GearItemTitle instance={target} />?
        </>
      }
      description="Salvaging items yields crafting materials"
      confirmLabel="Salvage"
      icon={Sparkles}
      dimBackground={false}
      dismissOnBackdrop={false}
      onCancel={onClear}
      onConfirm={() => {
        if (!editable) {
          onClear();
          return;
        }
        if (onSalvage(target.instanceId)) {
          playUISound("salvage");
          onClear();
        } else {
          playUISound("error");
        }
      }}
    />
  );
}

function renderDragVisualPortal(
  visual: GearDragVisual,
  isFlyoverEquip: boolean,
  onComplete: () => void,
  testId?: string,
) {
  const instance = visual.instance!;
  const def = gearDefinitions[instance.definitionId];
  if (!def) return null;
  const isAstral = gearInstanceRarity(instance) === "astral";
  const colors = getGearInstanceShineColors(instance);
  return (
    <DragVisualPortal
      visual={visual}
      {...(testId ? { testId } : {})}
      onComplete={onComplete}
      className={cn(isFlyoverEquip ? "" : "bg-background/60", !isAstral && "border border-stone-500/40")}
    >
      {isFlyoverEquip ? (
        <>
          <GearSlotArt definition={def} slot={(visual.destination as { slot: string }).slot as GearSlot} />
          {colors.length > 0 ? <ShineBorder shineColor={colors} borderWidth={1} /> : null}
        </>
      ) : (
        <>
          <img
            src={def.art}
            alt=""
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated"
          />
          {colors.length > 0 ? <ShineBorder shineColor={colors} borderWidth={1} /> : null}
        </>
      )}
    </DragVisualPortal>
  );
}

export function ArmoryOverlays(props: Props) {
  const {
    dragVisual,
    secondaryDragVisuals,
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
  } = props;

  return (
    <>
      {props.salvageTarget ? (
        <SalvageDialog
          target={props.salvageTarget}
          editable={editable}
          onSalvage={onSalvage}
          onClear={onClearSalvageTarget}
        />
      ) : null}
      {props.currencyDragVisual ? (
        <DragVisualPortal
          visual={props.currencyDragVisual}
          testId="armory-currency-drag-visual"
          className="border border-stone-500/40"
          onComplete={onClearCurrencyDragState}
        >
          <div className="relative h-full w-full">
            <img
              src={getCraftingCurrencyDefinition(props.currencyDragVisual.currencyId).art}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className={CURRENCY_COUNT_LABEL_CLASS}>
              {craftingCurrencies[props.currencyDragVisual.currencyId]}
            </span>
          </div>
        </DragVisualPortal>
      ) : null}
      {dragVisual && dragVisual.instance
        ? renderDragVisualPortal(
            dragVisual,
            !!(dragVisual.flyover && dragVisual.destination?.kind === "equipment"),
            onClearDragState,
          )
        : null}
      {secondaryDragVisuals.map((visual) =>
        visual.instance
          ? renderDragVisualPortal(visual, false, onClearSecondaryDragState, "armory-gear-swap-visual")
          : null,
      )}
      <ArmoryCurrencyCursor activeCurrencyId={props.activeCurrencyId} cursorPoint={props.cursorPoint} />
      {props.transferMenu ? (
        <ArmoryTransferMenu
          transferMenu={props.transferMenu}
          finishedRunCharacters={finishedRunCharacters}
          onTransferGear={onTransferGear}
          onClose={onCloseTransferMenu}
        />
      ) : null}
    </>
  );
}
