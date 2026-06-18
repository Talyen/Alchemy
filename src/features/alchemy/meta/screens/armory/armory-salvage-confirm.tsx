import { Sparkles } from "lucide-react";
import { ConfirmationDialog } from "../../../shared/ui/shared-ui";
import { GearItemTitle } from "../../../shared/ui/gear-item-title";
import type { GearInstance } from "@/lib/gear";

export function ArmorySalvageConfirm({
  target,
  editable,
  onCancel,
  onConfirm,
}: {
  target: GearInstance;
  editable: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmationDialog
      title={
        <>
          Salvage <GearItemTitle instance={target} />?
        </>
      }
      description="Salvaging items yields crafting materials"
      confirmLabel="Salvage"
      icon={Sparkles}
      dimBackground={false}
      dismissOnBackdrop={false}
      onCancel={onCancel}
      onConfirm={() => {
        if (!editable) {
          onCancel();
          return;
        }
        onConfirm();
      }}
    />
  );
}
