// Bottom-row battle resource controls and dev shortcut.
import { Coins, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ManaPanel, PilePanel } from "../../components";
import { battleBottomBarClass, battleBottomColumnClass } from "../../config";
import { BattleHand } from "./hand";
import type {
  BattleActionsProps,
  BattleHoverProps,
  BattleRefsProps,
  BattleScreenState,
  RequiredBattleViewProps,
} from "./types";

export function BattleBottomBar({
  view,
  hover,
  refs,
  actions,
}: {
  view: RequiredBattleViewProps;
  hover: BattleHoverProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
}) {
  const { battleState, isMobileLandscape } = view;

  return (
    <section className={isMobileLandscape ? battleBottomBarClass.mobile : battleBottomBarClass.desktop}>
      <div className={isMobileLandscape ? battleBottomColumnClass.mobile : battleBottomColumnClass.desktop}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} gold={battleState.gold} />
        <PilePanel
          label={isMobileLandscape ? "Deck" : "Draw Pile"}
          count={battleState.deck.length}
          type="draw"
          compact={isMobileLandscape}
        />
      </div>

      <BattleHand view={view} hover={hover} refs={refs} actions={actions} />

      <BattleControls battleState={battleState} isMobileLandscape={isMobileLandscape} actions={actions} />
    </section>
  );
}

function BattleControls({
  battleState,
  isMobileLandscape,
  actions,
}: {
  battleState: BattleScreenState;
  isMobileLandscape: boolean;
  actions: BattleActionsProps;
}) {
  const { onOpenMenu, onEndTurn, onSkipCombatDevMode } = actions;

  return (
    <div className={isMobileLandscape ? battleBottomColumnClass.mobile : battleBottomColumnClass.desktop}>
      <div className="relative flex flex-col items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className={isMobileLandscape ? "h-20 w-20 text-muted-foreground" : "h-8 w-8 text-muted-foreground"}
          onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
          aria-label="Open battle menu"
        >
          <Menu className={isMobileLandscape ? "h-11 w-11" : "h-4 w-4"} />
        </Button>

        <Button
          variant="default"
          size="sm"
          className={
            isMobileLandscape
              ? "h-20 bg-amber-600 px-10 text-2xl font-bold text-white"
              : "bg-amber-600 text-white font-bold"
          }
          onClick={onEndTurn}
          disabled={battleState.turnPhase !== "player"}
        >
          End Turn
        </Button>

        {import.meta.env.DEV ? (
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

      <PilePanel
        label={isMobileLandscape ? "Discard" : "Discard Pile"}
        count={battleState.discard.length}
        type="discard"
        compact={isMobileLandscape}
      />
    </div>
  );
}
