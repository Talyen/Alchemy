import { useRef, useState } from "react";

import { getCardKeywords, type BattleCard, type CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { useHeldWhile } from "../../../shared/ui/use-fade";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import {
  collectionTileWidthClass,
  getInspectionKeywordShineColors,
  bodyTextClass,
} from "@/features/alchemy/shared/config";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { cn } from "@/lib/utils";
import { WISH_OVERLAY_Z_INDEX } from "@/lib/game-constants";
import type { BattleActionsProps, BattleScreenState } from "./types";
import { useBattleDescriptionContext } from "./use-battle-description-context";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";

function WishCardItem({
  card,
  disabled,
  onSelect,
  descriptionContext,
}: {
  card: BattleCard;
  disabled: boolean;
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
      className="w-full"
      wrapperClassName={cn("flex min-w-0 shrink justify-center", collectionTileWidthClass)}
      disabled={disabled}
      shineColor={getInspectionKeywordShineColors(getCardKeywords(card))}
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
  const [isResolving, setIsResolving] = useState(false);
  const resolvingRef = useRef(false);
  const onWishChoiceRef = useLatestRef(onWishChoice);
  const descriptionContext = useBattleDescriptionContext(displayState);

  function resolveWish(card: BattleCard) {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setIsResolving(true);
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
      <div className="wish-overlay-panel alchemy-shell flex max-h-full w-fit max-w-5xl flex-col rounded-shell-screen border border-border/80 px-6 py-6">
        <ScreenHeader title="Wish" />
        <p className={cn("mt-2 text-center", bodyTextClass)}>Choose one card to add to your hand.</p>

        <div className="mt-6 flex min-h-0 items-start justify-center gap-5 overflow-y-auto p-3">
          {displayState.wishOptions?.map((card) => (
            <WishCardItem
              key={card.id}
              card={card}
              disabled={isResolving}
              onSelect={resolveWish}
              descriptionContext={descriptionContext}
            />
          ))}
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
  const [openSession, setOpenSession] = useState({ open, options: battleState.wishOptions, id: 0 });
  if (open !== openSession.open || (open && battleState.wishOptions !== openSession.options)) {
    setOpenSession({ open, options: battleState.wishOptions, id: open ? openSession.id + 1 : openSession.id });
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
