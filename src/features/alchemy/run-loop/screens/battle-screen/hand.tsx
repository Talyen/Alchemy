// Player hand fan for battle cards.
// Used by BattleBottomBar to render playable cards and animation refs.
import { type MouseEvent, type RefObject, memo, useLayoutEffect, useMemo, useRef } from "react";

import {
  HAND_CARD_BASE_Z_INDEX,
  HAND_CARD_HOVER_Z_INDEX,
  HAND_FAN_ROTATION_DEGREES,
  HAND_FAN_VERTICAL_STEP_PX,
  HAND_HOVER_LIFT_PX,
  HAND_HOVER_ROTATION_DEGREES,
  HAND_HOVER_TOOLTIP_PADDING_PX,
  HAND_REFLOW_MOTION_MS,
  HAND_REST_DROP_PX,
} from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import type { BattleCard, CardDescriptionContext } from "@/lib/game-data";

import { BattleCardButton } from "../../../shared/ui/card-button";
import { CombatantStatusEffectPresentation } from "../../../shared/ui/battle/combatant-status-effect-presentation";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import {
  battleHandContainerClass,
  getCardKeywordShineColors,
  handCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useBattleDescriptionContext } from "./use-battle-description-context";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { getHandCardKey, getPlayableHandCardKeys } from "../../battle/playable-hand";
import { getElementCenterX, playHandSlotReflow } from "../../battle/hand-slot-reflow";
import { useHiddenHandCardKeys, useInteractiveHandCardKeys } from "../../battle/presentation/use-hand-presentation";
import type { BattleState } from "@/lib/battle";
import { getActiveCcKeyword, type ActiveCcKeyword } from "../../../shared/utils/cc-presentation";

const HandCardItem = memo(function HandCardItem({
  card,
  index,
  handLength,
  handWidthClass,
  stagePixelRatio,
  handCardRefs,
  isInteractionEnabled,
  isVisuallyPlayable,
  isHidden,
  ccKeyword,
  onCardClick,
  descriptionContext,
}: {
  card: BattleCard;
  index: number;
  handLength: number;
  handWidthClass: string;
  stagePixelRatio: number;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  isInteractionEnabled: boolean;
  isVisuallyPlayable: boolean;
  isHidden: boolean;
  ccKeyword: ActiveCcKeyword | null;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  descriptionContext: CardDescriptionContext;
}) {
  const cardKey = getHandCardKey(card);
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("hand", cardKey);
  const offset = index - (handLength - 1) / 2;

  const elementRef = useRef<HTMLButtonElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const prevCenterXRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const centerX = getElementCenterX(slot);
    const previousCenterX = prevCenterXRef.current;
    prevCenterXRef.current = centerX;
    if (previousCenterX === null) return;
    return playHandSlotReflow(slot, previousCenterX - centerX, HAND_REFLOW_MOTION_MS);
  }, [cardKey, index, handLength]);
  /* eslint-enable react-compiler/react-compiler, react-hooks/immutability */

  return (
    <div
      ref={slotRef}
      className="relative -mx-5 flex justify-center sm:-mx-6"
      style={{
        zIndex: isHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
      }}
    >
      <CombatantStatusEffectPresentation keyword={ccKeyword}>
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
            isHovered
              ? getHoverHandTransform(offset, stagePixelRatio)
              : getRestingHandTransform(offset, stagePixelRatio)
          }
          className={cn(
            handWidthClass,
            "hand-card-motion",
            !isInteractionEnabled && "cursor-default",
            !isVisuallyPlayable && "grayscale",
          )}
          tooltipPadding={HAND_HOVER_TOOLTIP_PADDING_PX}
          dragging={isHidden}
          shineColor={getCardKeywordShineColors(card)}
          wrapperClassName="flex justify-center"
          wrapperDataCardKey={cardKey}
        />
      </CombatantStatusEffectPresentation>
    </div>
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
  const visuallyPlayableHandCardKeys = useMemo(() => getPlayableHandCardKeys(playabilityState), [playabilityState]);
  const interactiveHandCardKeys = useInteractiveHandCardKeys(playabilityState, visuallyPlayableHandCardKeys);
  const handWidthClass = handCardWidthClass;
  const descriptionContext = useBattleDescriptionContext(battleState);
  const ccKeyword = getActiveCcKeyword(battleState.playerCC);

  return (
    <div className={battleHandContainerClass}>
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
            isInteractionEnabled={interactiveHandCardKeys.has(cardKey)}
            isVisuallyPlayable={visuallyPlayableHandCardKeys.has(cardKey)}
            isHidden={hiddenHandCardKeys.includes(cardKey)}
            ccKeyword={ccKeyword}
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
  return `translateY(${y}px) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg)`;
}
