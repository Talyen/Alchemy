// Player hand fan for battle cards.
// Depends on battle controller playability props and hand layout constants.
// Used by BattleBottomBar to render playable cards and animation refs.
import { type CSSProperties, type MouseEvent, type RefObject, useLayoutEffect, useRef } from "react";

import {
  HAND_CARD_BASE_Z_INDEX,
  HAND_CARD_HOVER_Z_INDEX,
  HAND_FAN_ROTATION_DEGREES,
  HAND_FAN_VERTICAL_STEP_PX,
  HAND_HOVER_LIFT_PX,
  HAND_HOVER_ROTATION_DEGREES,
  HAND_HOVER_SCALE,
} from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import type { BattleCard } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import { battleHandContainerClass, handCardWidthClass } from "@/features/alchemy/shared/config";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import type { CardDescriptionContext } from "../../../shared/utils/card-description";

function HandCardItem({
  card,
  index,
  handLength,
  handWidthClass,
  stagePixelRatio,
  handCardRefs,
  hiddenHandCardKeys,
  revealedCardKeys,
  playableHandCardKeys,
  onCardClick,
  descriptionContext,
}: {
  card: BattleCard;
  index: number;
  handLength: number;
  handWidthClass: string;
  stagePixelRatio: number;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  hiddenHandCardKeys: Set<string>;
  revealedCardKeys: Set<string>;
  playableHandCardKeys: Set<string>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  descriptionContext: CardDescriptionContext;
}) {
  const cardKey = `${card.id}-${card.uid}`;
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "hand",
    `${card.id}-${card.uid}`,
  );
  const offset = index - (handLength - 1) / 2;
  const isRevealedFromTransfer = revealedCardKeys.has(cardKey);
  const shouldStagger = !hiddenHandCardKeys.has(cardKey) && !isRevealedFromTransfer;
  const canPlay = playableHandCardKeys.has(cardKey);

  const elementRef = useRef<HTMLButtonElement | null>(null);

  /* eslint-disable react-compiler/react-compiler, react-hooks/immutability --
     Writing to handCardRefs.current (a MutableRefObject) in useLayoutEffect and its cleanup
     is the correct imperative pattern for maintaining a live ref registry. The compiler
     flags this as a prop mutation; react-hooks/immutability similarly flags ref.current
     writes, but MutableRefObject.current writes are explicitly safe inside effects. */
  useLayoutEffect(() => {
    const el = elementRef.current;
    const currentRefs = handCardRefs.current;
    currentRefs[cardKey] = el;
    return () => {
      currentRefs[cardKey] = null;
    };
  }, [handCardRefs, cardKey]);
  /* eslint-enable react-compiler/react-compiler, react-hooks/immutability */

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={(event) => onCardClick(card, index, event)}
      buttonRef={elementRef}
      ariaLabel={`Play ${getCardDisplayTitle(card)}`}
      descriptionContext={descriptionContext}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      baseTransform={
        isHovered ? getHoverHandTransform(offset, stagePixelRatio) : getRestingHandTransform(offset, stagePixelRatio)
      }
      className={cn(handWidthClass, !canPlay && "cursor-default grayscale")}
      tiltEnabled={canPlay}
      dragging={hiddenHandCardKeys.has(cardKey)}
      wrapperClassName={cn(shouldStagger && "stagger-item", "relative flex justify-center -mx-5 sm:-mx-6")}
      wrapperDataCardKey={cardKey}
      wrapperStyle={
        {
          zIndex: isHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
          "--stagger-index": index,
        } as CSSProperties
      }
    />
  );
}

export function BattleHand({
  view,
  refs,
  actions,
}: {
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
}) {
  const { battleState, stagePixelRatio } = view;
  const { handCardRefs } = refs;
  const { hiddenHandCardKeys, playableHandCardKeys, revealedCardKeys, onCardClick } = actions;
  const handWidthClass = handCardWidthClass;

  const descriptionContext = {
    ...battleState.talentEffects,
    companionDamageBonus: battleState.trinketEffects.companionDamageBonus,
    companionDamageBuff: battleState.companionDamageBuff,
  };

  return (
    <div className={battleHandContainerClass} aria-label="Player hand">
      {battleState.hand.map((card, index) => (
        <HandCardItem
          key={`${card.id}-${card.uid}`}
          card={card}
          index={index}
          handLength={battleState.hand.length}
          handWidthClass={handWidthClass}
          stagePixelRatio={stagePixelRatio}
          handCardRefs={handCardRefs}
          hiddenHandCardKeys={hiddenHandCardKeys}
          revealedCardKeys={revealedCardKeys}
          playableHandCardKeys={playableHandCardKeys}
          onCardClick={onCardClick}
          descriptionContext={descriptionContext}
        />
      ))}
    </div>
  );
}

function getRestingHandTransform(offset: number, stagePixelRatio: number) {
  return `translateY(${Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX * stagePixelRatio}px) rotate(${offset * HAND_FAN_ROTATION_DEGREES}deg)`;
}

function getHoverHandTransform(offset: number, stagePixelRatio: number) {
  return `translateY(-${HAND_HOVER_LIFT_PX * stagePixelRatio}px) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg) scale(${HAND_HOVER_SCALE})`;
}
