import type { BattlePresentationStore } from "../../battle/battle-presentation-store";
import { useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { handHasPlayableCard } from "../../battle/playable-hand";
import { ManaPanel, PilePanel } from "../../battle/presentation/ui/resources";
import { battleBottomBarClass, battleBottomColumnClass } from "@/features/alchemy/shared/config";
import { BossLyrics } from "./boss-lyrics";
import { BattleHand } from "./hand";
import type { BattleActionsProps, BattleRefsProps, BattleScreenState, RequiredBattleViewProps } from "./types";
import { useCardTransferInProgress } from "../../battle/presentation/use-hand-presentation";
import type { BattleSnapshot } from "@/lib/battle";

export function BattleBottomBar({
  presentation,
  view,
  refs,
  actions,
  playabilityState,
}: {
  presentation: BattlePresentationStore;
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
  playabilityState: BattleSnapshot;
}) {
  const { battleState } = view;
  const { drawPileRef, discardPileRef } = refs;

  return (
    <section className={battleBottomBarClass}>
      {battleState.currentEnemy.enemyType === "boss" ? <BossLyrics bossId={battleState.currentEnemy.id} /> : null}
      <div className={cn(battleBottomColumnClass, "justify-self-start")}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} />
        <div className="flex justify-center">
          <PilePanel
            ref={drawPileRef}
            label="Draw Pile"
            count={battleState.deck.length}
            type="draw"
            onInspect={() => actions.onInspectPile?.("draw")}
            inspectable={actions.inspectionAvailable}
          />
        </div>
      </div>

      <BattleHand
        presentation={presentation}
        view={view}
        refs={refs}
        actions={actions}
        playabilityState={playabilityState}
      />

      <BattleControls
        presentation={presentation}
        battleState={battleState}
        playabilityState={playabilityState}
        actions={actions}
        discardPileRef={discardPileRef}
      />
    </section>
  );
}

function BattleControls({
  presentation,
  battleState,
  playabilityState,
  actions,
  discardPileRef,
}: {
  presentation: BattlePresentationStore;
  battleState: BattleScreenState;
  playabilityState: BattleSnapshot;
  actions: BattleActionsProps;
  discardPileRef: RefObject<HTMLDivElement | null>;
}) {
  const { onEndTurn } = actions;
  const cardTransferInProgress = useCardTransferInProgress(presentation);
  const [confirmationState, setConfirmationState] = useState<BattleSnapshot | null>(null);
  // Immutable snapshots invalidate confirmation after any gameplay change.
  const confirming = confirmationState === playabilityState;

  function requestEndTurn() {
    if (!confirming && handHasPlayableCard(playabilityState)) {
      setConfirmationState(playabilityState);
      return;
    }
    setConfirmationState(null);
    onEndTurn();
  }

  return (
    <div className={cn(battleBottomColumnClass, "justify-self-end")}>
      <div className="relative flex w-full flex-col items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="tracking-normal normal-case"
          data-battle-end-turn
          onClick={requestEndTurn}
          onBlur={() => setConfirmationState(null)}
          disabled={battleState.turnPhase !== "player" || cardTransferInProgress}
        >
          {confirming ? "Confirm" : "End Turn"}
        </Button>
      </div>

      <div className="flex w-full justify-center">
        <PilePanel
          ref={discardPileRef}
          label="Discard Pile"
          count={battleState.discard.length}
          type="discard"
          onInspect={() => actions.onInspectPile?.("discard")}
          inspectable={actions.inspectionAvailable}
        />
      </div>
    </div>
  );
}
