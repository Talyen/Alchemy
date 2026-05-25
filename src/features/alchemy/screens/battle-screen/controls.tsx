// Bottom-row battle resource controls and dev shortcut.
// Depends on battle resource widgets, hand rendering, and the shared Button primitive.
// Used only by BattleScreen to keep control layout separate from actor layout.
import type { MutableRefObject } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ManaPanel, PilePanel } from "../../components";
import { battleBottomBarClass, battleBottomColumnClass } from "../../config";
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
  const { battleState, isMobileLandscape } = view;
  const { drawPileRef, discardPileRef } = refs;

  return (
    <section className={isMobileLandscape ? battleBottomBarClass.mobile : battleBottomBarClass.desktop}>
      <div className={isMobileLandscape ? battleBottomColumnClass.mobile : battleBottomColumnClass.desktop}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
        <div className={!isMobileLandscape ? "mt-[1.5cqh]" : ""}>
          <PilePanel
            ref={drawPileRef}
            label={isMobileLandscape ? "Deck" : "Draw Pile"}
            count={battleState.deck.length}
            type="draw"
            compact={isMobileLandscape}
          />
        </div>
      </div>

      <BattleHand view={view} refs={refs} actions={actions} />

      <BattleControls
        battleState={battleState}
        isMobileLandscape={isMobileLandscape}
        actions={actions}
        discardPileRef={discardPileRef}
      />
    </section>
  );
}

function BattleControls({
  battleState,
  isMobileLandscape,
  actions,
  discardPileRef,
}: {
  battleState: BattleScreenState;
  isMobileLandscape: boolean;
  actions: BattleActionsProps;
  discardPileRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { onEndTurn, onSkipCombatDevMode, cardTransferInProgress, isDevMode } = actions;

  return (
    <div className={isMobileLandscape ? battleBottomColumnClass.mobile : battleBottomColumnClass.desktop}>
      <div className="relative flex flex-col items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className={
            isMobileLandscape
              ? "h-20 bg-amber-600 px-10 text-2xl font-bold text-white"
              : "bg-amber-600 text-white font-bold"
          }
          onClick={onEndTurn}
          disabled={battleState.turnPhase !== "player" || cardTransferInProgress}
        >
          End Turn
        </Button>

        {isDevMode ? (
          <Button
            variant="outline"
            size="sm"
            className={isMobileLandscape ? "h-20 w-20 text-amber-200 text-2xl" : "w-full text-amber-200 text-xs"}
            onClick={onSkipCombatDevMode}
          >
            <Coins className={isMobileLandscape ? "h-11 w-11" : "h-3.5 w-3.5"} />{" "}
            {isMobileLandscape ? "" : "Skip Combat"}
          </Button>
        ) : null}
      </div>

      <div className={!isMobileLandscape ? "mt-[1.5cqh]" : ""}>
        <PilePanel
          ref={discardPileRef}
          label={isMobileLandscape ? "Discard" : "Discard Pile"}
          count={battleState.discard.length}
          type="discard"
          compact={isMobileLandscape}
        />
      </div>
    </div>
  );
}
