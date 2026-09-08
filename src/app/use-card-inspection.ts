import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { isRunLoopScreen, type Screen } from "@/lib/routing";
import type { CardInspectionView } from "@/features/alchemy/shared/types";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { readCardInspectionData, useCardInspectionData } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  useCardAnimationInProgress,
  readCardAnimationInProgress,
  useHiddenHandCardKeys,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { readPlaybackPresentationGate } from "@/features/alchemy/run-loop/battle/use-battle-presentation-gate";
import { handHasHiddenCard } from "@/features/alchemy/run-loop/battle/playable-hand";
import type { CardInspectionCollection } from "@/features/alchemy/shared/ui/card-inspection-overlay";

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
      (data.battleReady && !cardAnimationInProgress && !handHasHiddenCard(data, hiddenHandCardKeys)));
  const close = useCallback(() => useUiStore.getState().setCardInspection(null), []);

  useLayoutEffect(() => close, [close, screen, data.mode, data.characterId, data.runSeed, data.hasActiveBattle]);
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
          !current.battleReady ||
          isCardPlayInProgress() ||
          readCardAnimationInProgress() ||
          handHasHiddenCard(current, presentation.hiddenHandCardKeys)
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
      companionDamageBonus: data.companionDamageBonus,
      companionDamageBuff: data.companionDamageBuff,
    }),
    [data.talentEffects, data.companionDamageBonus, data.companionDamageBuff],
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
