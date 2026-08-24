import { Sparkles } from "lucide-react";
import { type CraftingCurrencyId } from "@/lib/gear";
import { useHeldWhile } from "../../../shared/ui/fade-presence";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { SalvageYieldPreview } from "./salvage-yield-preview";
import type { ArmorySalvagePending } from "./armory-screen-types";
import { playUISound } from "@/lib/audio";

interface Props {
  salvagePending: ArmorySalvagePending | null;
  activeCurrencyId: CraftingCurrencyId | null;
  editable: boolean;
  onSalvage: (instanceId: string, salvageYield: ArmorySalvagePending["yield"]) => boolean;
  onClearSalvageTarget: () => void;
}

export function ArmoryOverlays({ salvagePending, activeCurrencyId, editable, onSalvage, onClearSalvageTarget }: Props) {
  const heldPending = useHeldWhile(salvagePending !== null, salvagePending);
  return (
    <>
      <ConfirmationDialog
        open={salvagePending !== null}
        title={
          heldPending ? (
            <>
              <span>Salvage </span>
              <GearItemTitle instance={heldPending.instance} />?
            </>
          ) : (
            "Salvage?"
          )
        }
        description="You will receive:"
        body={heldPending ? <SalvageYieldPreview salvageYield={heldPending.yield} /> : null}
        confirmLabel="Salvage"
        icon={Sparkles}
        dimBackground={false}
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
