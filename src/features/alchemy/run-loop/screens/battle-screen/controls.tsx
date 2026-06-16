// Bottom-row battle resource controls and dev shortcut.
// Depends on battle resource widgets, hand rendering, and the shared Button primitive.
// Used only by BattleScreen to keep control layout separate from actor layout.
import type { MutableRefObject } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ManaPanel, PilePanel } from "../../../shared/ui/battle-ui";
import { battleBottomBarClass, battleBottomColumnClass } from "@/features/alchemy/shared/config";
import { BattleHand } from "./hand";
import type { BattleActionsProps, BattleRefsProps, BattleScreenState, RequiredBattleViewProps } from "./types";

export function BattleBottomBar({
  view,
  refs,
  actions,
}: {
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
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

      <BattleHand view={view} refs={refs} actions={actions} />

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
  discardPileRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { onEndTurn, onSkipCombatDevMode, cardTransferInProgress, isDevMode } = actions;

  return (
    <div className={battleBottomColumnClass}>
      <div className="relative flex flex-col items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          className="font-bold"
          onClick={onEndTurn}
          disabled={battleState.turnPhase !== "player" || cardTransferInProgress}
        >
          End Turn
        </Button>

        {isDevMode ? (
          <Button variant="outline" size="sm" className="w-full text-amber-200 text-xs" onClick={onSkipCombatDevMode}>
            <Coins className="h-3.5 w-3.5" /> Skip Combat
          </Button>
        ) : null}
      </div>

      <div className="mt-[1.5cqh]">
        <PilePanel ref={discardPileRef} label="Discard Pile" count={battleState.discard.length} type="discard" />
      </div>
    </div>
  );
}
