import { type RefObject } from "react";
import { useGameTranslation } from "@/components/use-game-translation";
import { Button } from "@/components/ui/button";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { WISH_OVERLAY_Z_INDEX } from "@/lib/game-constants";
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { collectionTileWidthClass, getCardInspectionShineColors } from "../../shared/config";
import { BattleCardButton } from "../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../shared/ui/cards/card-description-ui";
import { ModalOverlayShell } from "../../shared/ui/dialogs/modal-overlay-shell";
import { useDialogFocus } from "../../shared/ui/dialogs/use-dialog-focus";
import { ScreenHeader } from "../../shared/ui/layout-components";

function PotionChoices({
  offers,
  onChoose,
  onClose,
  returnFocusRef,
}: {
  offers: BattleCard[];
  onChoose: (index: number) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const i18n = useGameTranslation();
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Choice dialog contains keyboard focus like the Wish panel.
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="wish-overlay-panel alchemy-shell flex max-h-full w-fit max-w-5xl flex-col rounded-shell-screen border border-border/80 px-6 py-6"
    >
      <ScreenHeader title={i18n.text("ui.brew-potion-panel.d1", "Choose a Potion")} />
      <div className="mt-6 flex min-h-0 items-start justify-center gap-5 overflow-y-auto p-3">
        {offers.map((card, index) => (
          <BattleCardButton
            key={index}
            card={card}
            onClick={() => onChoose(index)}
            ariaLabel={i18n.text("ui.wish-overlay.1", "Choose {{value0}}", {
              value0: i18n.read(() => getCardDisplayTitle(card)),
            })}
            className="w-full"
            wrapperClassName={cn("flex min-w-0 shrink justify-center", collectionTileWidthClass)}
            shineColor={getCardInspectionShineColors(card)}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Button size="lg" variant="outline" onClick={onClose}>
          {i18n.text("ui.brew-potion-panel.6", "Back")}
        </Button>
      </div>
    </div>
  );
}

export function BrewPotionChoiceOverlay({
  open,
  offers,
  onChoose,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  offers: BattleCard[];
  onChoose: (index: number) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <ModalOverlayShell
      open={open}
      escapeId="brew-potion-choices"
      onClose={onClose}
      dismissOnBackdrop
      escapePriority={ESCAPE_PRIORITY.DIALOG}
      zIndex={WISH_OVERLAY_Z_INDEX}
      className="wish-overlay-backdrop flex items-center justify-center p-6"
    >
      <PotionChoices
        offers={offers}
        onChoose={(index) => {
          if (open) onChoose(index);
        }}
        onClose={onClose}
        returnFocusRef={returnFocusRef}
      />
    </ModalOverlayShell>
  );
}
