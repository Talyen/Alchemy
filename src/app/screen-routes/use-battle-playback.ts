// Route-local battle playback: autoplay ticks and auto-end-turn.
// Lives next to battle display so combat ticks do not re-render the shell controller.
// Session autoplay on/off is owned by the battle controller so it survives route unmount.
import { useCallback, useMemo } from "react";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useBattleAutoEndTurn, useBattleAutoplay } from "@/features/alchemy/run-loop/battle";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import type { BattlePlaybackBind } from "@/features/alchemy/run-loop/battle/battle-context";

interface UseBattlePlaybackProps {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  gameMenuOpen: boolean;
  isAutoplayEnabled: boolean;
  setAutoplayEnabled: (enabled: boolean) => void;
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
  setAutoplayEnabled,
  handleEndTurn,
  handleAutoplayCard,
  isCardPlayInProgress,
}: UseBattlePlaybackProps) {
  const autoEndTurn = useSettingsStore((s) => s.autoEndTurn);
  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabled(!isAutoplayEnabled);
  }, [isAutoplayEnabled, setAutoplayEnabled]);

  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn: autoEndTurn || isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    isCardPlayInProgress,
    onEndTurn: handleEndTurn,
  });

  useBattleAutoplay({
    enabled: isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    isCardPlayInProgress,
    gameMenuOpen,
    playCard: handleAutoplayCard,
  });

  const bind = useMemo(
    () =>
      ({
        scheduleAutoEndTurn,
        clearAutoEndTurn,
        onBattleSessionPrepared: () => undefined,
      }) satisfies BattlePlaybackBind,
    [scheduleAutoEndTurn, clearAutoEndTurn],
  );

  return {
    isAutoplayEnabled,
    toggleAutoplay,
    bind,
  };
}
