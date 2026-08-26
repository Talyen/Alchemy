// Bottom-row battle resource controls and dev shortcut.
// Used only by BattleScreen to keep control layout separate from actor layout.
import type { RefObject } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ManaPanel, PilePanel } from "../../../shared/ui/battle-ui";
import { battleBottomBarClass, battleBottomColumnClass, BUTTON_WIDTH_DIALOG } from "@/features/alchemy/shared/config";
import { BattleHand } from "./hand";
import type { BattleActionsProps, BattleRefsProps, BattleScreenState, RequiredBattleViewProps } from "./types";
import { useCardTransferInProgress } from "../../battle/presentation/use-hand-presentation";
import type { BattleState } from "@/lib/battle";

export function BattleBottomBar({
  view,
  refs,
  actions,
  playabilityState,
}: {
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
  playabilityState: BattleState;
}) {
  const { battleState } = view;
  const { drawPileRef, discardPileRef } = refs;

  return (
    <section className={battleBottomBarClass}>
      <div className={battleBottomColumnClass}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
        <div className="mt-[1.5cqh]">
          <PilePanel ref={drawPileRef} label="Draw Pile" count={battleState.deck.length} type="draw" />
        </div>
      </div>

      <BattleHand view={view} refs={refs} actions={actions} playabilityState={playabilityState} />

      <BattleControls battleState={battleState} actions={actions} discardPileRef={discardPileRef} />
    </section>
  );
}

function BattleControls({
  battleState,
  actions,
  discardPileRef,
}: {
  battleState: BattleScreenState;
  actions: BattleActionsProps;
  discardPileRef: RefObject<HTMLDivElement | null>;
}) {
  const { onEndTurn, onSkipCombatDevMode, isDevMode } = actions;
  const cardTransferInProgress = useCardTransferInProgress();

  return (
    <div className={battleBottomColumnClass}>
      <div className="relative flex flex-col items-center gap-2">
        <Button
          variant="primary"
          size="lg"
          className={cn("font-bold", BUTTON_WIDTH_DIALOG)}
          onClick={onEndTurn}
          disabled={battleState.turnPhase !== "player" || cardTransferInProgress}
        >
          End Turn
        </Button>

        {isDevMode ? (
          <div className="flex w-full flex-col gap-1">
            <Button variant="outline" size="sm" className="w-full text-xs text-amber-200" onClick={onSkipCombatDevMode}>
              <Coins className="h-3.5 w-3.5" /> Skip Combat
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-[1.5cqh]">
        <PilePanel ref={discardPileRef} label="Discard Pile" count={battleState.discard.length} type="discard" />
      </div>
    </div>
  );
}
