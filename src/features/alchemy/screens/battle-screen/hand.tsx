// Player hand fan for battle cards.
import type { CSSProperties } from "react";

import {
  HAND_CARD_BASE_Z_INDEX,
  HAND_CARD_HOVER_Z_INDEX,
  HAND_FAN_ROTATION_DEGREES,
  HAND_FAN_VERTICAL_STEP_PX,
  HAND_HOVER_LIFT_PX,
  HAND_HOVER_ROTATION_DEGREES,
  HAND_HOVER_SCALE,
} from "@/lib/game-constants";
import { getEffectiveCost } from "@/lib/battle";

import { BattleCardButton, getCardDisplayTitle } from "../../components";
import { battleHandContainerClass, handCardWidthClass, mobileStageHandCardWidthClass } from "../../config";
import { getHoverId } from "../../utils";
import type { BattleActionsProps, BattleHoverProps, BattleRefsProps, RequiredBattleViewProps } from "./types";

export function BattleHand({
  view,
  hover,
  refs,
  actions,
}: {
  view: RequiredBattleViewProps;
  hover: BattleHoverProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
}) {
  const { battleState, isMobileLandscape } = view;
  const { hoveredCardId, setHoveredCardId, shimmerState, onHoverShimmer } = hover;
  const { handCardRefs } = refs;
  const { onCardClick } = actions;
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;

  return (
    <div className={isMobileLandscape ? battleHandContainerClass.mobile : battleHandContainerClass.desktop} aria-label="Player hand">
      {battleState.hand.map((card, index) => {
        const hoverId = getHoverId("hand", `${card.id}-${card.uid}`);
        const isHovered = hoveredCardId === hoverId;
        const offset = index - (battleState.hand.length - 1) / 2;
        const isShimmering = shimmerState?.cardId === hoverId;
        const canPlay = battleState.turnPhase === "player" && battleState.mana >= getEffectiveCost(battleState, card) && !battleState.wishOptions;

        return (
          <BattleCardButton
            key={`${card.id}-${card.uid}`}
            card={card}
            hovered={isHovered}
            onHoverStart={() => {
              setHoveredCardId(hoverId);
              onHoverShimmer(hoverId);
            }}
            onHoverEnd={() => setHoveredCardId((current) => (current === hoverId ? null : current))}
            onClick={(event) => onCardClick(card, index, event)}
            buttonRef={(node) => {
              handCardRefs.current[`${card.id}-${card.uid}`] = node;
            }}
            ariaLabel={`Play ${getCardDisplayTitle(card)}`}
            shimmerActive={isShimmering}
            shimmerToken={shimmerState?.token}
            baseTransform={isHovered ? getHoverHandTransform(offset) : getRestingHandTransform(offset)}
            className={handWidthClass}
            disabled={!canPlay}
            wrapperClassName={`stagger-item relative flex justify-center ${isMobileLandscape ? "-mx-7" : "-mx-5 sm:-mx-6"}`}
            wrapperStyle={
              {
                zIndex: isHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
                "--stagger-index": index,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function getRestingHandTransform(offset: number) {
  return `translateY(${Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX}px) rotate(${offset * HAND_FAN_ROTATION_DEGREES}deg)`;
}

function getHoverHandTransform(offset: number) {
  return `translateY(-${HAND_HOVER_LIFT_PX}px) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg) scale(${HAND_HOVER_SCALE})`;
}
