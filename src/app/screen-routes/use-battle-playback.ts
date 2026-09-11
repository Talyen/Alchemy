import { useLayoutEffect, useMemo, useRef } from "react";
import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import type { BattlePlaybackBind } from "@/features/alchemy/run-loop/battle/battle-context";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";

interface UseBattlePlaybackProps {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen: boolean;
  isAutoplayEnabled: boolean;
  handleEndTurn: () => void;
  handleAutoplayCard: (card: BattleCard, index: number) => boolean;
  isCardPlayInProgress: () => boolean;
  bindPlayback?: ((bind: BattlePlaybackBind | null) => void) | undefined;
}

export function useBattlePlayback({
  screen,
  battleState,
  hasActiveBattle,
  gameMenuOpen,
  isAutoplayEnabled,
  handleEndTurn,
  handleAutoplayCard,
  isCardPlayInProgress,
  bindPlayback,
}: UseBattlePlaybackProps) {
  const autoEndTurn = useSettingsStore((s) => s.autoEndTurn);
  const scheduleAutoEndTurnRef = useRef<(state?: BattleSnapshot) => void>(() => {});
  const wakeAutoplayRef = useRef<(() => void) | null>(null);

  const onPlaybackGateChangeRef = useLatestRef(() => {
    scheduleAutoEndTurnRef.current();
    wakeAutoplayRef.current?.();
  });
  const presentationGateRef = useBattlePresentationGateRef(onPlaybackGateChangeRef);

  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn: autoEndTurn || isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    gameMenuOpen,
    isCardPlayInProgress,
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
    gameMenuOpen,
    playCard: handleAutoplayCard,
    presentationGateRef,
    wakeRef: wakeAutoplayRef,
  });

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
