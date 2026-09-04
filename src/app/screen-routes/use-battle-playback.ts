import { useMemo, useRef } from "react";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useBattleAutoEndTurn, useBattleAutoplay } from "@/features/alchemy/run-loop/battle";
import type { BattlePlaybackBind } from "@/features/alchemy/run-loop/battle/battle-context";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/use-battle-presentation-gate";

interface UseBattlePlaybackProps {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  gameMenuOpen: boolean;
  isAutoplayEnabled: boolean;
  toggleAutoplay: () => void;
  handleEndTurn: () => void;
  handleAutoplayCard: (card: BattleCard, index: number) => boolean;
  isCardPlayInProgress: () => boolean;
}

export function useBattlePlayback({
  screen,
  battleState,
  hasActiveBattle,
  gameMenuOpen,
  isAutoplayEnabled,
  toggleAutoplay,
  handleEndTurn,
  handleAutoplayCard,
  isCardPlayInProgress,
}: UseBattlePlaybackProps) {
  const autoEndTurn = useSettingsStore((s) => s.autoEndTurn);
  const scheduleAutoEndTurnRef = useRef<(state?: BattleState) => void>(() => {});
  const wakeAutoplayRef = useRef<(() => void) | null>(null);
  const onPlaybackGateChangeRef = useRef<() => void>(() => {});

  // eslint-disable-next-line react-hooks/refs -- latest playback callbacks; not a render input
  onPlaybackGateChangeRef.current = () => {
    scheduleAutoEndTurnRef.current();
    wakeAutoplayRef.current?.();
  };
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

  return {
    isAutoplayEnabled,
    toggleAutoplay,
    bind,
  };
}
