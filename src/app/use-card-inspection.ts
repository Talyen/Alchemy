import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { isRunLoopScreen, type Screen } from "@/lib/routing";
import type { CardInspectionView } from "@/features/alchemy/shared/types";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { readCardInspectionData, useCardInspectionData } from "@/features/alchemy/shared/stores/run-reads";
import {
  readCardAnimationInProgress,
  readPlaybackPresentationGate,
  useCardAnimationInProgress,
  useHiddenHandCardKeys,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { handHasHiddenCard, type HiddenHandCardKeys } from "@/features/alchemy/run-loop/battle/playable-hand";
import type { BattleSnapshot } from "@/lib/battle";
import type { CardInspectionCollection } from "@/features/alchemy/shared/ui/inspection/card-inspection-overlay";

const RUN_META_SCREENS: readonly Screen[] = ["armory", "talents", "homestead", "collection", "options"];

export function isDeckInspectionVisible(
  screen: Screen,
  hasActiveRun: boolean,
  returnToRunScreen: Screen | null,
): boolean {
  if (screen === "draft-deck") return true;
  if (!hasActiveRun) return false;
  return (
    isRunLoopScreen(screen) ||
    (RUN_META_SCREENS.includes(screen) &&
      returnToRunScreen !== null &&
      (isRunLoopScreen(returnToRunScreen) || returnToRunScreen === "draft-deck"))
  );
}

/**
 * Shared battle gate for deck inspection. The render path (canOpen) feeds it
 * reactive hook values; the event path (onOpen) feeds it fresh reads plus an
 * additional card-play-in-progress check, so both stay in agreement.
 */
export function isBattleInspectionBlocked(input: {
  battleReady: boolean;
  cardAnimationInProgress: boolean;
  battleState: Pick<BattleSnapshot, "hand">;
  hiddenHandCardKeys: HiddenHandCardKeys;
}): boolean {
  if (!input.battleReady) return true;
  if (input.cardAnimationInProgress) return true;
  if (handHasHiddenCard(input.battleState, input.hiddenHandCardKeys)) return true;
  return false;
}

export function useCardInspection({
  screen,
  screenInteractive,
  returnToRunScreen,
  isCardPlayInProgress,
  gameMenuOpen,
  boonInspectOpen,
  closeOtherOverlays,
}: {
  screen: Screen;
  screenInteractive: boolean;
  returnToRunScreen: Screen | null;
  isCardPlayInProgress: () => boolean;
  gameMenuOpen: boolean;
  boonInspectOpen: boolean;
  closeOtherOverlays: () => void;
}) {
  const data = useCardInspectionData();
  const selected = useUiStore((state) => state.cardInspection);
  const cardAnimationInProgress = useCardAnimationInProgress();
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const visible = isDeckInspectionVisible(screen, data.hasActiveRun, returnToRunScreen);
  const canOpen =
    visible &&
    screenInteractive &&
    (!data.hasActiveBattle ||
      !isBattleInspectionBlocked({
        battleReady: data.battleReady,
        cardAnimationInProgress,
        battleState: data,
        hiddenHandCardKeys,
      }));
  const close = useCallback(() => useUiStore.getState().setCardInspection(null), []);

  // Close inspection whenever the run/screen/battle identity changes underneath it.
  useLayoutEffect(
    () => () => close(),
    [close, screen, data.mode, data.characterId, data.runSeed, data.hasActiveBattle],
  );
  useLayoutEffect(() => {
    if (!canOpen || gameMenuOpen || boonInspectOpen) close();
  }, [canOpen, close, gameMenuOpen, boonInspectOpen]);

  const onOpen = useCallback(
    (view: CardInspectionView) => {
      if (!canOpen) return;
      const current = readCardInspectionData();
      if (current.mode !== data.mode || current.characterId !== data.characterId || current.runSeed !== data.runSeed)
        return;
      if (!current.hasActiveBattle && view !== "deck") return;
      if (current.hasActiveBattle) {
        const presentation = readPlaybackPresentationGate();
        if (
          isCardPlayInProgress() ||
          isBattleInspectionBlocked({
            battleReady: current.battleReady,
            cardAnimationInProgress: readCardAnimationInProgress(),
            battleState: current,
            hiddenHandCardKeys: presentation.hiddenHandCardKeys,
          })
        )
          return;
      }
      if (useUiStore.getState().cardInspection === null) {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      closeOtherOverlays();
      useUiStore.getState().setCardInspection(view);
    },
    [canOpen, closeOtherOverlays, data.mode, data.characterId, data.runSeed, isCardPlayInProgress],
  );

  const collections = useMemo<CardInspectionCollection[]>(
    () => [
      { id: "deck", cards: data.runDeck },
      ...(data.hasActiveBattle
        ? [
            { id: "draw" as const, cards: data.drawPile },
            { id: "discard" as const, cards: data.discardPile },
          ]
        : []),
    ],
    [data.runDeck, data.hasActiveBattle, data.drawPile, data.discardPile],
  );
  const battleDescriptionContext = useMemo(
    () => ({
      ...data.talentEffects,
      companionDamageModifiers: {
        damageBonus: data.companionDamageBonus,
        bleedDamageBonus: data.companionBleedDamageBonus,
        damageMultiplier: data.companionDamageMultiplier,
      },
    }),
    [data.talentEffects, data.companionDamageBonus, data.companionBleedDamageBonus, data.companionDamageMultiplier],
  );

  return {
    visible,
    canOpen,
    selected,
    open: selected !== null && canOpen,
    close,
    onOpen,
    collections,
    returnFocusRef,
    count: data.runDeck.length,
    battleDescriptionContext: data.hasActiveBattle ? battleDescriptionContext : null,
  };
}
