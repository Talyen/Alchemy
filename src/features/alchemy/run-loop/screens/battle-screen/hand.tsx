// Player hand fan for battle cards.
// Depends on battle controller playability props and hand layout constants.
// Used by BattleBottomBar to render playable cards and animation refs.
import { type MouseEvent, type RefObject, memo, useLayoutEffect, useMemo, useRef } from "react";

import {
  HAND_CARD_BASE_Z_INDEX,
  HAND_CARD_HOVER_Z_INDEX,
  HAND_FAN_ROTATION_DEGREES,
  HAND_FAN_VERTICAL_STEP_PX,
  HAND_HOVER_LIFT_PX,
  HAND_HOVER_ROTATION_DEGREES,
  HAND_HOVER_SCALE,
  HAND_HOVER_TOOLTIP_PADDING_PX,
  HAND_REST_DROP_PX,
} from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import {
  battleHandContainerClass,
  getCardKeywordShineColors,
  handCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { getHandCardKey } from "../../battle/playable-hand";
import { useHiddenHandCardKeys, usePlayableHandCardKeys } from "../../battle/presentation/use-hand-presentation";
import type { BattleState } from "@/lib/battle";

const HandCardItem = memo(function HandCardItem({
  card,
  index,
  handLength,
  handWidthClass,
  stagePixelRatio,
  handCardRefs,
  canPlay,
  isHidden,
  onCardClick,
  descriptionContext,
}: {
  card: BattleCard;
  index: number;
  handLength: number;
  handWidthClass: string;
  stagePixelRatio: number;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  canPlay: boolean;
  isHidden: boolean;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  descriptionContext: CardDescriptionContext;
}) {
  const cardKey = getHandCardKey(card);
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("hand", cardKey);
  const offset = index - (handLength - 1) / 2;

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
      className={cn(handWidthClass, "hand-card-motion", !canPlay && "cursor-default grayscale")}
      tooltipPadding={HAND_HOVER_TOOLTIP_PADDING_PX}
      tiltEnabled={canPlay}
      dragging={isHidden}
      shineColor={getCardKeywordShineColors(card)}
      wrapperClassName="relative -mx-5 flex justify-center sm:-mx-6"
      wrapperDataCardKey={cardKey}
      wrapperStyle={{
        zIndex: isHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
      }}
    />
  );
});

export function BattleHand({
  view,
  refs,
  actions,
  playabilityState,
}: {
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
  playabilityState: BattleState;
}) {
  const { battleState, stagePixelRatio } = view;
  const { handCardRefs } = refs;
  const { onCardClick } = actions;
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  const playableHandCardKeys = usePlayableHandCardKeys(playabilityState);
  const handWidthClass = handCardWidthClass;

  const descriptionContext = useMemo(
    () => ({
      ...battleState.talentEffects,
      companionDamageBonus: battleState.trinketEffects.companionDamageBonus,
      companionDamageBuff: battleState.companionDamageBuff,
    }),
    [battleState.talentEffects, battleState.trinketEffects.companionDamageBonus, battleState.companionDamageBuff],
  );

  return (
    <div className={battleHandContainerClass} aria-label="Player hand">
      {battleState.hand.map((card, index) => {
        const cardKey = getHandCardKey(card);
        return (
          <HandCardItem
            key={cardKey}
            card={card}
            index={index}
            handLength={battleState.hand.length}
            handWidthClass={handWidthClass}
            stagePixelRatio={stagePixelRatio}
            handCardRefs={handCardRefs}
            canPlay={playableHandCardKeys.has(cardKey)}
            isHidden={hiddenHandCardKeys.includes(cardKey)}
            onCardClick={onCardClick}
            descriptionContext={descriptionContext}
          />
        );
      })}
    </div>
  );
}

function getRestingHandTransform(offset: number, stagePixelRatio: number) {
  const y = (HAND_REST_DROP_PX + Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX) * stagePixelRatio;
  return `translateY(${y}px) rotate(${offset * HAND_FAN_ROTATION_DEGREES}deg)`;
}

function getHoverHandTransform(offset: number, stagePixelRatio: number) {
  const y = (HAND_REST_DROP_PX - HAND_HOVER_LIFT_PX) * stagePixelRatio;
  return `translateY(${y}px) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg) scale(${HAND_HOVER_SCALE})`;
}
