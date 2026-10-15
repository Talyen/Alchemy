import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { CircleArrowRight } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { ChromeIconButton } from "@/features/alchemy/shared/ui/chrome-icon-button";
import { ConfirmationDialog } from "@/features/alchemy/shared/ui/dialogs";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/tooltips/portaled-tooltip";
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
  isProgressSavePending,
  subscribeProgressSave,
  onEndTurn,
}: BattleEndTurnButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [confirmationState, setConfirmationState] = useState<BattleSnapshot | null>(null);
  const pendingConfirmation = useRef<BattleSnapshot | null>(null);
  const inspectionOpen = useUiStore(isBattleInspectionOpen);
  const savePending = useSyncExternalStore(subscribeProgressSave, isProgressSavePending);
  const gate = useStore(
    presentation,
    useShallow((state) => ({
      cardTransferInProgress: state.cardTransferInProgress,
      hiddenHandCardKeys: state.hiddenHandCardKeys,
      endTurnConfirmationOpen: state.endTurnConfirmationOpen,
      displayedBattle: state.displayedBattle,
      openingDrawPending: state.openingDrawPending,
    })),
  );

  function canEndTurn() {
    const current = presentation.getState();
    return (
      !blocked &&
      !isProgressSavePending() &&
      !current.openingDrawPending &&
      !isBattlePlaybackBlocked({
        ...readPlaybackPresentationGate(presentation),
        // This control owns the pending confirmation; all other inputs honor it.
        endTurnConfirmationOpen: false,
        battleState,
        hasActiveBattle,
        screen,
        cardPlayInProgress: isCardPlayInProgress(),
        inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
      })
    );
  }

  const unavailable = savePending || inspectionOpen || gate.openingDrawPending || !canEndTurn();
  const open =
    gate.endTurnConfirmationOpen && confirmationState !== null && confirmationState === battleState && !unavailable;
  const closeConfirmation = useCallback(() => {
    pendingConfirmation.current = null;
    setConfirmationState(null);
    presentation.getState().setEndTurnConfirmationOpen(false);
  }, [presentation]);

  if (confirmationState !== null && !open) setConfirmationState(null);
  useLayoutEffect(() => {
    if (!open) {
      pendingConfirmation.current = null;
      presentation.getState().setEndTurnConfirmationOpen(false);
    }
  }, [open, presentation]);
  useLayoutEffect(
    () => () => {
      pendingConfirmation.current = null;
      presentation.getState().setEndTurnConfirmationOpen(false);
    },
    [presentation],
  );

  return (
    <>
      <ChromeIconButton
        ref={buttonRef}
        aria-label="End Turn"
        data-battle-end-turn
        disabled={unavailable || gate.endTurnConfirmationOpen}
        onClick={() => {
          if (!canEndTurn() || presentation.getState().endTurnConfirmationOpen) return;
          pendingConfirmation.current = battleState;
          presentation.getState().setEndTurnConfirmationOpen(true);
          setConfirmationState(battleState);
          setHovered(false);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <CircleArrowRight className="h-6 w-6" aria-hidden="true" />
      </ChromeIconButton>
      <PortaledTooltip
        triggerRef={buttonRef}
        visible={!unavailable && !gate.endTurnConfirmationOpen && (hovered || focused)}
        placement="below"
        allowFlip={false}
        horizontalInset={8}
      >
        End Turn
      </PortaledTooltip>
      <ConfirmationDialog
        open={open}
        title="End turn?"
        description="Discard your hand and let the enemy act."
        confirmLabel="End Turn"
        tone="default"
        icon={CircleArrowRight}
        returnFocusRef={buttonRef}
        onCancel={closeConfirmation}
        onConfirm={() => {
          const expected = pendingConfirmation.current;
          closeConfirmation();
          if (expected === battleState && canEndTurn()) onEndTurn(expected);
        }}
      />
    </>
  );
}
