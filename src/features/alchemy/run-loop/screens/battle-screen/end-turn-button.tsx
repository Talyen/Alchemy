import { useGameTranslation } from "@/components/use-game-translation";
import { useSyncExternalStore, type RefObject } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { isBattleInspectionOpen, useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { BattlePresentationStore } from "../../battle/battle-presentation-store";
import { isBattlePlaybackBlocked } from "../../battle/playback-gate";
import { readPlaybackPresentationGate } from "../../battle/presentation/use-hand-presentation";

export interface BattleEndTurnButtonProps {
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  screen: Screen;
  blocked: boolean;
  presentation: BattlePresentationStore;
  buttonRef: RefObject<HTMLButtonElement | null>;
  isCardPlayInProgress: () => boolean;
  subscribePlayback: (listener: () => void) => () => void;
  isProgressSavePending: () => boolean;
  subscribeProgressSave: (listener: () => void) => () => void;
  onEndTurn: (expected: BattleSnapshot) => void;
}

export function BattleEndTurnButton({
  battleState,
  hasActiveBattle,
  screen,
  blocked,
  presentation,
  buttonRef,
  isCardPlayInProgress,
  subscribePlayback,
  isProgressSavePending,
  subscribeProgressSave,
  onEndTurn,
}: BattleEndTurnButtonProps) {
  const i18n = useGameTranslation();
  const inspectionOpen = useUiStore(isBattleInspectionOpen);
  const playing = useSyncExternalStore(subscribePlayback, isCardPlayInProgress);
  const saving = useSyncExternalStore(subscribeProgressSave, isProgressSavePending);
  useStore(
    presentation,
    useShallow((state) => ({
      cardTransferInProgress: state.cardTransferInProgress,
      hiddenHandCardKeys: state.hiddenHandCardKeys,
      openingDrawPending: state.openingDrawPending,
    })),
  );
  function canEndTurn() {
    return (
      !blocked &&
      !isProgressSavePending() &&
      !presentation.getState().openingDrawPending &&
      !isBattlePlaybackBlocked({
        ...readPlaybackPresentationGate(presentation),
        battleState,
        hasActiveBattle,
        screen,
        cardPlayInProgress: isCardPlayInProgress(),
        inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
      })
    );
  }
  return (
    <Button
      ref={buttonRef}
      variant="outline"
      size="sm"
      className="tracking-normal normal-case"
      data-battle-end-turn
      disabled={playing || saving || inspectionOpen || !canEndTurn()}
      onClick={() => {
        if (canEndTurn()) onEndTurn(battleState);
      }}
    >
      {i18n.text("ui.end-turn-button.1", "End Turn")}
    </Button>
  );
}
