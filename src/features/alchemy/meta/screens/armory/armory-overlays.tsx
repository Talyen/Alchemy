import { Sparkles } from "lucide-react";
import { type CraftingCurrencyId, type GearInstance } from "@/lib/gear";
import { useHeldWhile } from "../../../shared/ui/fade-presence";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import { ArmoryCurrencyCursor } from "./armory-currency-targeting";
import { playUISound } from "@/lib/audio";

interface Props {
  salvageTarget: GearInstance | null;
  activeCurrencyId: CraftingCurrencyId | null;
  cursorPoint: { x: number; y: number } | null;
  editable: boolean;
  onSalvage: (instanceId: string) => boolean;
  onClearSalvageTarget: () => void;
}

export function ArmoryOverlays({
  salvageTarget,
  activeCurrencyId,
  cursorPoint,
  editable,
  onSalvage,
  onClearSalvageTarget,
}: Props) {
  const heldTarget = useHeldWhile(salvageTarget !== null, salvageTarget);
  return (
    <>
      <ConfirmationDialog
        open={salvageTarget !== null}
        title={
          heldTarget ? (
            <>
              <span>Salvage </span>
              <GearItemTitle instance={heldTarget} />?
            </>
          ) : (
            "Salvage?"
          )
        }
        description="Salvaging items yields crafting materials"
        confirmLabel="Salvage"
        icon={Sparkles}
        dimBackground={false}
        dismissOnBackdrop={false}
        onCancel={onClearSalvageTarget}
        onConfirm={() => {
          if (!heldTarget) return;
          if (!editable) {
            onClearSalvageTarget();
            return;
          }
          if (onSalvage(heldTarget.instanceId)) {
            playUISound("salvage");
            onClearSalvageTarget();
          } else {
            playUISound("error");
          }
        }}
      />
      <ArmoryCurrencyCursor activeCurrencyId={activeCurrencyId} cursorPoint={cursorPoint} />
    </>
  );
}
