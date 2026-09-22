import { type MouseEvent, type RefObject, memo, useEffect, useLayoutEffect, useRef } from "react";

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
import { useUiStore } from "../../../shared/stores/ui-store";
import { getHoverId } from "../../../shared/utils";
import { CombatantStatusEffectPresentation } from "../../../shared/ui/battle/combatant-status-effect-presentation";
import { getCardDisplayTitle } from "../../../shared/ui/card-description-ui";
import {
  battleHandContainerClass,
  getCardKeywordShineColors,
  handCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import { useHandPointer } from "./use-hand-pointer";
import { useBattleDescriptionContext } from "./use-battle-description-context";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { getHandCardKey } from "../../battle/playable-hand";
import { getElementCenterX, playHandSlotReflow } from "./hand-slot-reflow";
import {
  useCardAnimationInProgress,
  useHiddenHandCardKeys,
  useInteractiveHandCardKeys,
  usePlayableHandCardKeys,
} from "../../battle/presentation/use-hand-presentation";
import type { BattleSnapshot } from "@/lib/battle";
import { focusControl } from "../../../shared/ui/focus-navigation";
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
  const cardKey = getHandCardKey(card, index);
  const { isHovered, shimmerActive, shimmerToken } = useInteractiveCard("hand", cardKey);
  // Autoplay previews reuse the hover lift + shine without the description popup.
  const isPreview = useUiStore((s) => s.autoplayPreviewCardId === getHoverId("hand", cardKey));
  const visualHovered = isHovered || isPreview;
  const offset = index - (handLength - 1) / 2;

  const elementRef = useRef<HTMLButtonElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const prevCenterXRef = useRef<number | null>(null);

  /* eslint-disable react-hooks/immutability -- Writing to handCardRefs.current (a MutableRefObject) in useLayoutEffect and its cleanup is the correct imperative pattern for maintaining a live ref registry; MutableRefObject.current writes are explicitly safe inside effects. */
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
    const artwork = slot.firstElementChild;
    if (!(artwork instanceof HTMLElement)) return;
    return playHandSlotReflow(artwork, previousCenterX - centerX, HAND_REFLOW_MOTION_MS);
  }, [cardKey, index, handLength]);
  /* eslint-enable react-hooks/immutability -- re-enable immutability checks after ref registry effects */

  return (
    <div
      ref={slotRef}
      data-hand-slot={cardKey}
      data-hovered={isHovered || undefined}
      data-hand-hidden={isHidden || undefined}
      className="relative flex min-w-0 shrink basis-[calc(var(--hand-card-width)-3*var(--content-rem,1rem))] justify-center"
      style={{
        zIndex: visualHovered ? HAND_CARD_HOVER_Z_INDEX : HAND_CARD_BASE_Z_INDEX + index,
      }}
    >
      <div className="flex shrink-0 justify-center">
        <CombatantStatusEffectPresentation keyword={ccKeyword}>
          <BattleCardButton
            card={card}
            hovered={visualHovered}
            suppressTooltip={isPreview && !isHovered}
            onHoverStart={ignoreArtworkHover}
            onHoverEnd={ignoreArtworkHover}
            onClick={(event) => onCardClick(card, index, event)}
            buttonRef={elementRef}
            ariaDisabled={!isInteractionEnabled}
            ariaLabel={`Play ${getCardDisplayTitle(card)}`}
            descriptionContext={descriptionContext}
            shimmerActive={shimmerActive}
            shimmerToken={shimmerToken}
            baseTransform={
              visualHovered
                ? getHoverHandTransform(offset, stagePixelRatio)
                : getRestingHandTransform(offset, stagePixelRatio)
            }
            className={cn(
              handWidthClass,
              "hand-card-motion",
              visualHovered ? "scale-[1.035]" : "scale-100",
              !isInteractionEnabled && "cursor-default",
              !isVisuallyPlayable && "grayscale",
            )}
            tooltipPadding={HAND_HOVER_TOOLTIP_PADDING_PX}
            scaleOnHover={false}
            dragging={isHidden}
            shineColor={getCardKeywordShineColors(card)}
            wrapperClassName="flex shrink-0 justify-center"
            wrapperDataCardKey={cardKey}
          />
        </CombatantStatusEffectPresentation>
      </div>
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
  playabilityState: BattleSnapshot;
}) {
  const { battleState, stagePixelRatio } = view;
  const { handCardRefs } = refs;
  const { onCardClick } = actions;
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  const visuallyPlayableHandCardKeys = usePlayableHandCardKeys(playabilityState);
  const interactiveHandCardKeys = useInteractiveHandCardKeys(playabilityState, visuallyPlayableHandCardKeys);
  const animationInProgress = useCardAnimationInProgress();
  const keyboardActivation = useRef(false);
  const recovery = useRef<{ played: string; order: string[] } | null>(null);
  const pointer = useHandPointer(battleState.hand, hiddenHandCardKeys, handCardRefs);
  const handWidthClass = handCardWidthClass;
  const descriptionContext = useBattleDescriptionContext(battleState);
  const ccKeyword = getActiveCcKeyword(battleState.playerCC);

  function playCard(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    const key = getHandCardKey(card, index);
    if (
      keyboardActivation.current &&
      interactiveHandCardKeys.has(key) &&
      document.activeElement === event.currentTarget &&
      event.detail === 0
    ) {
      const keys = battleState.hand.map(getHandCardKey);
      recovery.current = { played: key, order: [...keys.slice(index + 1), ...keys.slice(0, index).reverse()] };
    }
    keyboardActivation.current = false;
    onCardClick(card, index, event);
  }

  useEffect(() => {
    const cancel = () => {
      recovery.current = null;
      keyboardActivation.current = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (["Tab", "Escape"].includes(event.key)) cancel();
    };
    document.addEventListener("pointerdown", cancel, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useLayoutEffect(() => {
    const pending = recovery.current;
    if (
      !pending ||
      animationInProgress ||
      battleState.hand.some((card, index) => getHandCardKey(card, index) === pending.played)
    )
      return;
    if (battleState.turnPhase !== "player" || battleState.wishOptions?.length) return;
    const key = [...pending.order, ...battleState.hand.map(getHandCardKey)].find((candidate) =>
      interactiveHandCardKeys.has(candidate),
    );
    const target = key
      ? handCardRefs.current[key]
      : pointer.ref.current?.parentElement?.querySelector<HTMLButtonElement>("[data-battle-end-turn]");
    if (focusControl(target)) recovery.current = null;
  }, [
    battleState.hand,
    battleState.turnPhase,
    battleState.wishOptions,
    animationInProgress,
    interactiveHandCardKeys,
    handCardRefs,
    pointer.ref,
  ]);

  return (
    <div
      {...pointer}
      onKeyDownCapture={(event) => {
        keyboardActivation.current = !event.repeat && (event.key === "Enter" || event.key === " ");
      }}
      data-testid="battle-hand"
      className={battleHandContainerClass}
      style={{
        paddingBottom: `calc(${12 + Math.max(0, battleState.hand.length - 4) * 12}px * var(--content-scale, 1))`,
      }}
    >
      {battleState.hand.map((card, index) => {
        const cardKey = getHandCardKey(card, index);
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
            onCardClick={playCard}
            descriptionContext={descriptionContext}
          />
        );
      })}
    </div>
  );
}

function getRestingHandTransform(offset: number, stagePixelRatio: number) {
  const y = (HAND_REST_DROP_PX + Math.abs(offset) * HAND_FAN_VERTICAL_STEP_PX) * stagePixelRatio;
  return `translateY(calc(${y}px * var(--content-scale, 1))) rotate(${offset * HAND_FAN_ROTATION_DEGREES}deg)`;
}

function getHoverHandTransform(offset: number, stagePixelRatio: number) {
  const y = (HAND_REST_DROP_PX - HAND_HOVER_LIFT_PX) * stagePixelRatio;
  return `translateY(calc(${y}px * var(--content-scale, 1))) rotate(${offset * HAND_HOVER_ROTATION_DEGREES}deg)`;
}

function ignoreArtworkHover() {}
