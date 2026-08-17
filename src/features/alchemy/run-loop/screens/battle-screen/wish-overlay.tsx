// Wish selection overlay for battle.
import { useEffect, useMemo, useRef, useState } from "react";

import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { fadePhaseClass, useFadePresence, useHeldWhile } from "../../../shared/ui/fade-presence";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import { handCardWidthClass, BUTTON_WIDTH_ACTION, bodyTextClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import type { BattleActionsProps, BattleScreenState } from "./types";
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

export function WishOverlay({
  open,
  battleState,
  actions,
}: {
  open: boolean;
  battleState: BattleScreenState;
  actions: BattleActionsProps;
}) {
  const { mounted, phase } = useFadePresence(open);
  const displayState = useHeldWhile(open, battleState);
  const { onWishChoice } = actions;
  const [wishSelectedCard, setWishSelectedCard] = useState<BattleCard | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const resolvingRef = useRef(false);
  const onWishChoiceRef = useRef(onWishChoice);
  const handWidthClass = handCardWidthClass;

  useEffect(() => {
    onWishChoiceRef.current = onWishChoice;
  }, [onWishChoice]);

  const descriptionContext = useMemo(
    () => ({
      ...displayState.talentEffects,
      companionDamageBonus: displayState.trinketEffects.companionDamageBonus,
      companionDamageBuff: displayState.companionDamageBuff,
    }),
    [displayState.talentEffects, displayState.trinketEffects.companionDamageBonus, displayState.companionDamageBuff],
  );

  useEffect(() => {
    if (!open) return;
    resolvingRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset wish selection when the overlay opens again
    setIsResolving(false);
    setWishSelectedCard(null);
  }, [open]);

  function resolveWish(card: BattleCard | null) {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setIsResolving(true);
    onWishChoiceRef.current(card);
    setWishSelectedCard(null);
  }

  useEffect(() => {
    if (!mounted || phase === "exit") return;
    return pushEscapeHandler({
      id: "wish-overlay",
      priority: ESCAPE_PRIORITY.MODAL,
      onEscape: () => {
        if (resolvingRef.current) return;
        resolvingRef.current = true;
        setIsResolving(true);
        onWishChoiceRef.current(null);
        setWishSelectedCard(null);
      },
    });
  }, [mounted, phase]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "wish-overlay-backdrop absolute inset-0 z-[90] flex items-center justify-center bg-black/70 px-6",
        fadePhaseClass(phase),
      )}
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
    </div>
  );
}
