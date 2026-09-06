import type { RefObject } from "react";
import { Sparkles } from "lucide-react";
import { gearDefinitions, type CraftingCurrencyId } from "@/lib/gear";
import { useHeldWhile } from "../../../shared/ui/use-fade";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { SalvageYieldPreview } from "./salvage-yield-preview";
import type { ArmorySalvagePending } from "./armory-screen-types";
import { playUISound } from "@/lib/audio";

interface Props {
  salvagePending: ArmorySalvagePending | null;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  activeCurrencyId: CraftingCurrencyId | null;
  equippedCharacterName: string | null;
  editable: boolean;
  onSalvage: (instanceId: string, salvageYield: ArmorySalvagePending["yield"]) => boolean;
  onClearSalvageTarget: () => void;
}

export function ArmoryOverlays({
  salvagePending,
  returnFocusRef,
  activeCurrencyId,
  equippedCharacterName,
  editable,
  onSalvage,
  onClearSalvageTarget,
}: Props) {
  const heldCharacterName = useHeldWhile(salvagePending !== null, equippedCharacterName);
  const heldPending = useHeldWhile(salvagePending !== null, salvagePending);
  return (
    <>
      <ConfirmationDialog
        open={salvagePending !== null}
        title="Salvage"
        returnFocusRef={returnFocusRef}
        description={
          heldPending ? (
            <>
              Salvaging <GearItemTitle instance={heldPending.instance} className="whitespace-normal" /> will yield:
            </>
          ) : undefined
        }
        body={
          heldPending ? (
            <div className="space-y-4">
              <img
                src={gearDefinitions[heldPending.instance.definitionId]?.art}
                alt=""
                className="mx-auto h-24 w-24 rounded-xl object-contain"
              />
              {heldCharacterName ? (
                <p className="text-sm text-amber-200">
                  Equipped by {heldCharacterName}. Salvaging will unequip this item.
                </p>
              ) : null}
              <SalvageYieldPreview salvageYield={heldPending.yield} />
            </div>
          ) : null
        }
        confirmLabel="Salvage"
        icon={Sparkles}
        dismissOnBackdrop={false}
        onCancel={onClearSalvageTarget}
        onConfirm={() => {
          if (!heldPending) return;
          if (!editable) {
            onClearSalvageTarget();
            return;
          }
          if (onSalvage(heldPending.instance.instanceId, heldPending.yield)) {
            playUISound("salvage");
            onClearSalvageTarget();
          } else {
            playUISound("error");
          }
        }}
      />
      <ArmoryCurrencyCursor activeCurrencyId={activeCurrencyId} />
    </>
  );
}
