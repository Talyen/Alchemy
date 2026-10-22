import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import { useSettingsStore } from "@/features/alchemy/shared/stores/react/settings-store";
import { isBattleInspectionOpen, useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import type {
  AutoplayCardHandler,
  AutoplayWishHandler,
  BattlePlaybackBind,
} from "@/features/alchemy/run-loop/battle/battle-context";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";

import type { BattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

interface UseBattlePlaybackProps {
  presentation: BattlePresentationStore;
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen: boolean;
  boonInspectOpen?: boolean;
  isAutoplayEnabled: boolean;
  handleEndTurn: (expected: BattleSnapshot) => void;
  handleAutoplayCard: AutoplayCardHandler;
  handleAutoplayWish: AutoplayWishHandler;
  isCardPlayInProgress: () => boolean;
  isProgressSavePending?: (() => boolean) | undefined;
  subscribeProgressSave?: ((listener: () => void) => () => void) | undefined;
  bindPlayback?: ((bind: BattlePlaybackBind | null) => void) | undefined;
}

export function useBattlePlayback({
  presentation,
  screen,
  battleState,
  hasActiveBattle,
  gameMenuOpen,
  boonInspectOpen = false,
  isAutoplayEnabled,
  handleEndTurn,
  handleAutoplayCard,
  handleAutoplayWish,
  isCardPlayInProgress,
  isProgressSavePending,
  subscribeProgressSave,
  bindPlayback,
}: UseBattlePlaybackProps) {
  const autoEndTurn = useSettingsStore((s) => s.autoEndTurn);
  const inspectionOpen = useUiStore(isBattleInspectionOpen);
  const scheduleAutoEndTurnRef = useRef<(state?: BattleSnapshot) => void>(() => {});
  const wakeAutoplayRef = useRef<(() => void) | null>(null);

  const onPlaybackGateChangeRef = useLatestRef(() => {
    scheduleAutoEndTurnRef.current();
    wakeAutoplayRef.current?.();
  });
  useLayoutEffect(
    () =>
      subscribeProgressSave?.(() => {
        scheduleAutoEndTurnRef.current();
        wakeAutoplayRef.current?.();
      }),
    [subscribeProgressSave],
  );
  const presentationGateRef = useBattlePresentationGateRef(presentation, onPlaybackGateChangeRef);

  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn: autoEndTurn || isAutoplayEnabled,
    isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    gameMenuOpen,
    boonInspectOpen,
    isCardPlayInProgress,
    isProgressSavePending,
    onEndTurn: handleEndTurn,
    presentationGateRef,
    scheduleAutoEndTurnRef,
  });

  useBattleAutoplay({
    enabled: isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    isCardPlayInProgress,
    isProgressSavePending,
    gameMenuOpen,
    boonInspectOpen,
    playCard: handleAutoplayCard,
    playWish: handleAutoplayWish,
    presentationGateRef,
    wakeRef: wakeAutoplayRef,
  });

  // A timer that fired while an overlay was open rechecks the gate and returns.
  // Wake automation again when the overlay closes so it cannot stay stalled.
  useEffect(() => {
    if (boonInspectOpen || gameMenuOpen || inspectionOpen) return;
    scheduleAutoEndTurnRef.current();
    wakeAutoplayRef.current?.();
  }, [boonInspectOpen, gameMenuOpen, inspectionOpen]);

  const bind = useMemo(
    () =>
      ({
        scheduleAutoEndTurn,
        clearAutoEndTurn,
      }) satisfies BattlePlaybackBind,
    [scheduleAutoEndTurn, clearAutoEndTurn],
  );

  const bindPlaybackRef = useLatestRef(bindPlayback);
  useLayoutEffect(() => {
    const currentBind = bindPlaybackRef.current;
    if (!currentBind) return;
    currentBind(bind);
    return () => currentBind(null);
  }, [bind, bindPlaybackRef]);
  // No return value: the bind is forwarded to the controller via bindPlayback.
  // Callers needing schedule/clear access should go through routeCommands.battle.
}
