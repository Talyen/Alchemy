import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { useState, type ReactNode } from "react";

import { type BattleCard, type CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/cards/card-description-ui";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { ScreenHeader } from "../../../shared/ui/layout-components";
import {
  collectionTileWidthClass,
  getCardInspectionShineColors,
  bodyTextClass,
} from "@/features/alchemy/shared/config";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { cn } from "@/lib/utils";
import { MAX_HAND_SIZE, WISH_OVERLAY_Z_INDEX } from "@/lib/game-constants";
import { useDialogFocus } from "../../../shared/ui/use-dialog-focus";
import type { BattleActionsProps, BattleScreenState } from "./types";
import { useBattleDescriptionContext } from "./use-battle-description-context";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { useUiStore } from "../../../shared/stores/ui-store";
import { getHoverId } from "../../../shared/utils";

function WishCardItem({
  card,
  onSelect,
  descriptionContext,
}: {
  card: BattleCard;
  onSelect: (card: BattleCard) => void;
  descriptionContext: CardDescriptionContext;
}) {
  useGameTranslation();
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("wish", card.id);
  // Autoplay previews reuse the hover lift without the description popup.
  const isPreview = useUiStore((s) => s.autoplayPreviewCardId === getHoverId("wish", card.id));

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered || isPreview}
      suppressTooltip={isPreview && !isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={() => onSelect(card)}
      ariaLabel={gameText("ui.wish-overlay.1", "Choose {{value0}}", { value0: getCardDisplayTitle(card) })}
      descriptionContext={descriptionContext}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      className="w-full"
      wrapperClassName={cn("flex min-w-0 shrink justify-center", collectionTileWidthClass)}
      shineColor={getCardInspectionShineColors(card)}
    />
  );
}

function WishOverlayPanel({
  open,
  displayState,
  onWishChoice,
}: {
  open: boolean;
  displayState: BattleScreenState;
  onWishChoice: (card: BattleCard) => void;
}) {
  useGameTranslation();
  const onWishChoiceRef = useLatestRef(onWishChoice);
  const descriptionContext = useBattleDescriptionContext(displayState);

  function resolveWish(card: BattleCard) {
    onWishChoiceRef.current(card);
  }

  return (
    <ModalOverlayShell
      open={open}
      escapeId="wish-overlay"
      onClose={() => {}}
      zIndex={WISH_OVERLAY_Z_INDEX}
      className="wish-overlay-backdrop flex items-center justify-center p-6"
    >
      <WishPanel>
        <ScreenHeader title={gameText("ui.wish-overlay.2", "Wish")} />
        <p className={cn("mt-2 text-center", bodyTextClass)}>
          {displayText(
            displayState.hand.length >= MAX_HAND_SIZE
              ? gameText("ui.wish-overlay.d1", "Your hand is full. Choose one card to wait until space opens.")
              : gameText("ui.wish-overlay.d2", "Choose one card to add to your hand."),
          )}
        </p>

        <div className="mt-6 flex min-h-0 items-start justify-center gap-5 overflow-y-auto p-3">
          {displayState.wishOptions?.map((card) => (
            <WishCardItem key={card.id} card={card} onSelect={resolveWish} descriptionContext={descriptionContext} />
          ))}
        </div>
      </WishPanel>
    </ModalOverlayShell>
  );
}

function WishPanel({ children }: { children: ReactNode }) {
  useGameTranslation();
  const { panelRef, handleKeyDown } = useDialogFocus();
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Mandatory choice modal contains keyboard focus
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={gameText("ui.wish-overlay.3", "Wish")}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="wish-overlay-panel alchemy-shell flex max-h-full w-fit max-w-5xl flex-col rounded-shell-screen border border-border/80 px-6 py-6"
    >
      {children}
    </div>
  );
}

export function WishOverlay({
  open,
  battleState,
  actions,
}: {
  open: boolean;
  battleState: BattleScreenState;
  actions: BattleActionsProps;
}) {
  useGameTranslation();
  // ModalOverlayShell holds the rendered choices and descriptions through exit;
  // a second snapshot here would also retain unrelated battle piles and events.
  const [openSession, setOpenSession] = useState({ open, options: battleState.wishOptions, id: 0 });
  if (open !== openSession.open || (open && battleState.wishOptions !== openSession.options)) {
    setOpenSession({ open, options: battleState.wishOptions, id: open ? openSession.id + 1 : openSession.id });
  }

  return (
    <WishOverlayPanel key={openSession.id} open={open} displayState={battleState} onWishChoice={actions.onWishChoice} />
  );
}
