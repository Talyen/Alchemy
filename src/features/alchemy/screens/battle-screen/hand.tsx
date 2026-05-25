// Player hand fan for battle cards.
// Depends on battle/screen stores, card cost logic, and hand layout constants.
// Used by BattleBottomBar to render playable cards and animation refs.
import type { CSSProperties, MouseEvent, MutableRefObject } from "react";

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
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

import { BattleCardButton, getCardDisplayTitle } from "../../components";
import { battleHandContainerClass, handCardWidthClass, mobileStageHandCardWidthClass } from "../../config";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useBattleStore } from "../../stores/battle-store";
import { useInteractiveCard } from "../../ui/use-interactive-card";
import type { CardDescriptionContext } from "../../utils/card-description";

function HandCardItem({
  card,
  index,
  handLength,
  handWidthClass,
  stagePixelRatio,
  isMobileLandscape,
  handCardRefs,
  hiddenHandCardKeys,
  revealedCardKeys,
  onCardClick,
  descriptionContext,
  turnPhase,
  mana,
  wishOptions,
  costState,
}: {
  card: BattleCard;
  index: number;
  handLength: number;
  handWidthClass: string;
  stagePixelRatio: number;
  isMobileLandscape: boolean;
  handCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  hiddenHandCardKeys: Set<string>;
  revealedCardKeys: Set<string>;
  onCardClick: (card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) => void;
  descriptionContext: CardDescriptionContext;
  turnPhase: string;
  mana: number;
  wishOptions: unknown;
  costState: Pick<BattleState, "flags" | "talentEffects" | "trinketEffects">;
}) {
  const cardKey = `${card.id}-${card.uid}`;
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "hand",
    `${card.id}-${card.uid}`,
  );
  const offset = index - (handLength - 1) / 2;
  const isRevealedFromTransfer = revealedCardKeys.has(cardKey);
  const shouldStagger = !hiddenHandCardKeys.has(cardKey) && !isRevealedFromTransfer;
  const canPlay = turnPhase === "player" && mana >= getEffectiveCost(costState, card) && !wishOptions;
  const refs = handCardRefs;

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={(event) => onCardClick(card, index, event)}
      buttonRef={(node) => {
        // eslint-disable-next-line react-hooks/immutability
        refs.current[cardKey] = node;
      }}
      ariaLabel={`Play ${getCardDisplayTitle(card)}`}
      descriptionContext={descriptionContext}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      baseTransform={
        isHovered ? getHoverHandTransform(offset, stagePixelRatio) : getRestingHandTransform(offset, stagePixelRatio)
      }
      className={handWidthClass}
      disabled={!canPlay}
      dragging={hiddenHandCardKeys.has(cardKey)}
      wrapperClassName={`${shouldStagger ? "stagger-item" : ""} relative flex justify-center ${isMobileLandscape ? "-mx-7" : "-mx-5 sm:-mx-6"}`}
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
  const { battleState, isMobileLandscape, stagePixelRatio } = view;
  const { handCardRefs } = refs;
  const { hiddenHandCardKeys } = actions;
  const revealedCardKeys = useBattleStore((s) => s.revealedCardKeys);
  const { onCardClick } = actions;
  const handWidthClass = isMobileLandscape ? mobileStageHandCardWidthClass : handCardWidthClass;

  const descriptionContext = {
    ...battleState.talentEffects,
    companionDamageBonus: battleState.trinketEffects.companionDamageBonus,
    companionDamageBuff: battleState.companionDamageBuff,
  };

  const costState: Pick<BattleState, "flags" | "talentEffects" | "trinketEffects"> = {
    flags: battleState.flags,
    talentEffects: battleState.talentEffects,
    trinketEffects: battleState.trinketEffects,
  };

  return (
    <div
      className={isMobileLandscape ? battleHandContainerClass.mobile : battleHandContainerClass.desktop}
      aria-label="Player hand"
    >
      {battleState.hand.map((card, index) => (
        <HandCardItem
          key={`${card.id}-${card.uid}`}
          card={card}
          index={index}
          handLength={battleState.hand.length}
          handWidthClass={handWidthClass}
          stagePixelRatio={stagePixelRatio}
          isMobileLandscape={isMobileLandscape}
          handCardRefs={handCardRefs}
          hiddenHandCardKeys={hiddenHandCardKeys}
          revealedCardKeys={revealedCardKeys}
          onCardClick={onCardClick}
          descriptionContext={descriptionContext}
          turnPhase={battleState.turnPhase}
          mana={battleState.mana}
          wishOptions={battleState.wishOptions}
          costState={costState}
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
