import { GameMessage } from "@/components/localization";
import { useGameTranslation } from "@/components/use-game-translation";
import type { RefObject } from "react";
import { Sparkles } from "lucide-react";
import { gearDefinitions, type CraftingCurrencyId } from "@/lib/gear";
import { useHeldWhile } from "../../../shared/ui/use-fade";
import { ConfirmationDialog } from "../../../shared/ui/dialogs";
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
  onSalvage: (instanceId: string) => boolean;
  afterProgressSaved?: (feedback: () => void) => void;
  onClearSalvageTarget: () => void;
}

export function ArmoryOverlays({
  salvagePending,
  returnFocusRef,
  activeCurrencyId,
  equippedCharacterName,
  editable,
  onSalvage,
  afterProgressSaved = (feedback) => feedback(),
  onClearSalvageTarget,
}: Props) {
  const i18n = useGameTranslation();
  const heldCharacterName = useHeldWhile(salvagePending !== null, equippedCharacterName);
  const heldPending = useHeldWhile(salvagePending !== null, salvagePending);
  return (
    <>
      <ConfirmationDialog
        open={salvagePending !== null}
        title={i18n.text("ui.armory-overlays.1", "Salvage")}
        returnFocusRef={returnFocusRef}
        description={i18n.displayText(
          heldPending ? (
            <>
              <GameMessage
                id="armory.salvage-yield"
                defaultValue="Salvaging <item/> will yield:"
                parts={{ item: <GearItemTitle instance={heldPending.instance} className="whitespace-normal" /> }}
              />
            </>
          ) : undefined,
        )}
        body={
          heldPending ? (
            <div className="space-y-4">
              <img
                src={gearDefinitions[heldPending.instance.definitionId]?.art}
                alt=""
                decoding="async"
                className="mx-auto h-24 w-24 rounded-xl object-contain"
              />
              {heldCharacterName ? (
                <p className="text-sm text-warning">
                  <GameMessage
                    id="ui.armory-overlays.s1"
                    defaultValue="Equipped by <part0/>. Salvaging will unequip this item."
                    parts={{ part0: i18n.displayText(heldCharacterName) }}
                  />
                </p>
              ) : null}
              <SalvageYieldPreview salvageYield={heldPending.yield} />
            </div>
          ) : null
        }
        confirmLabel={i18n.text("ui.armory-overlays.4", "Salvage")}
        icon={Sparkles}
        dismissOnBackdrop={false}
        onCancel={onClearSalvageTarget}
        onConfirm={() => {
          if (!heldPending) return;
          if (!editable) {
            onClearSalvageTarget();
            return;
          }
          if (onSalvage(heldPending.instance.instanceId)) {
            afterProgressSaved(() => playUISound("salvage"));
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
