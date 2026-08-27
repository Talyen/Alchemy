// Wish selection overlay for battle.
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { useHeldWhile } from "../../../shared/ui/fade-presence";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import { handCardWidthClass, BUTTON_WIDTH_ACTION, bodyTextClass } from "@/features/alchemy/shared/config";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { cn } from "@/lib/utils";
import { WISH_OVERLAY_Z_INDEX } from "@/lib/game-constants";
import type { BattleActionsProps, BattleScreenState } from "./types";
import { useBattleDescriptionContext } from "./use-battle-description-context";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";

function WishCardItem({
  card,
  handWidthClass,
  selected,
  onSelect,
  descriptionContext,
}: {
  card: BattleCard;
  handWidthClass: string;
  selected: boolean;
  onSelect: (card: BattleCard) => void;
  descriptionContext: CardDescriptionContext;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("wish", card.id);

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={() => onSelect(card)}
      ariaLabel={`Choose ${getCardDisplayTitle(card)}`}
      descriptionContext={descriptionContext}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      className={handWidthClass}
      wrapperClassName="relative flex justify-center"
      selected={selected}
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
  onWishChoice: (card: BattleCard | null) => void;
}) {
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const resolvingRef = useRef(false);
  const onWishChoiceRef = useLatestRef(onWishChoice);
  const handWidthClass = handCardWidthClass;
  const descriptionContext = useBattleDescriptionContext(displayState);

  function resolveWish(card: BattleCard | null) {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setIsResolving(true);
    onWishChoiceRef.current(card);
    setWishSelectedCard(null);
  }

  return (
    <ModalOverlayShell
      open={open}
      escapeId="wish-overlay"
      onClose={() => resolveWish(null)}
      zIndex={WISH_OVERLAY_Z_INDEX}
      className="wish-overlay-backdrop flex items-center justify-center px-6"
    >
      <div className="wish-overlay-panel alchemy-shell w-full max-w-5xl rounded-shell-screen border border-border/80 px-6 py-6">
        <ScreenHeader title="Wish" />
        <p className={cn("mt-2 text-center", bodyTextClass)}>Choose one card to add to your hand, or skip.</p>

        <div className="mt-6 flex flex-wrap items-start justify-center gap-5">
          {displayState.wishOptions?.map((card) => (
            <WishCardItem
              key={card.id}
              card={card}
              handWidthClass={handWidthClass}
              selected={wishSelectedCard?.id === card.id}
              onSelect={isResolving ? () => {} : setWishSelectedCard}
              descriptionContext={descriptionContext}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="outline"
            size="lg"
            className={BUTTON_WIDTH_ACTION}
            disabled={isResolving}
            onClick={() => resolveWish(null)}
          >
            Skip
          </Button>
          <Button
            size="lg"
            className={BUTTON_WIDTH_ACTION}
            disabled={isResolving || !wishSelectedCard}
            onClick={() => resolveWish(wishSelectedCard)}
          >
            Confirm
          </Button>
        </div>
      </div>
    </ModalOverlayShell>
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
  const displayState = useHeldWhile(open, battleState);
  const [openSession, setOpenSession] = useState({ open, id: 0 });
  if (open !== openSession.open) {
    setOpenSession({ open, id: open ? openSession.id + 1 : openSession.id });
  }

  return (
    <WishOverlayPanel
      key={openSession.id}
      open={open}
      displayState={displayState}
      onWishChoice={actions.onWishChoice}
    />
  );
}
