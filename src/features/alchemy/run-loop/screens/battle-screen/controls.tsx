import type { ReactNode } from "react";
import { useStore } from "zustand";
import { useGameTranslation } from "@/components/use-game-translation";
import { ManaPanel } from "../../battle/presentation/ui/mana-dock";
import { PilePanel } from "../../battle/presentation/ui/resources";
import { battleBottomColumnClass } from "@/features/alchemy/shared/config";
import type { BattlePresentationStore } from "../../battle/battle-presentation-store";

import { battleBottomBarClass } from "@/features/alchemy/shared/config";
import { BossLyrics } from "./boss-lyrics";
import { BattleHand } from "./hand";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
import type { BattleSnapshot } from "@/lib/battle";

export function BattleBottomBar({
  endTurn,
  onInspectPile,
  inspectionAvailable,
  presentation,
  view,
  refs,
  actions,
  playabilityState,
}: {
  endTurn: ReactNode;
  onInspectPile: (view: "draw" | "discard") => void;
  inspectionAvailable: boolean;
  presentation: BattlePresentationStore;
  view: RequiredBattleViewProps;
  refs: BattleRefsProps;
  actions: BattleActionsProps;
  playabilityState: BattleSnapshot;
}) {
  const i18n = useGameTranslation();
  const { battleState } = view;
  const { drawPileRef, discardPileRef } = refs;
  const openingDrawPending = useStore(presentation, (state) => state.openingDrawPending);

  return (
    <section className={battleBottomBarClass} data-battle-bottom-bar>
      {battleState.currentEnemy.enemyType === "boss" ? <BossLyrics bossId={battleState.currentEnemy.id} /> : null}
      <div className={battleBottomColumnClass}>
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} presentation={presentation} />
        <PilePanel
          ref={drawPileRef}
          label={i18n.text("battle.draw-pile", "Draw Pile")}
          count={battleState.deck.length}
          type="draw"
          onInspect={() => onInspectPile("draw")}
          inspectable={inspectionAvailable}
          overflowCards={battleState.pendingHandCards}
          openingDrawPending={openingDrawPending}
        />
      </div>
      <div className="battle-hand-dock">
        <BattleHand
          presentation={presentation}
          view={view}
          refs={refs}
          actions={actions}
          playabilityState={playabilityState}
        />
      </div>
      <div className={battleBottomColumnClass}>
        {endTurn}
        <PilePanel
          ref={discardPileRef}
          label={i18n.text("battle.discard-pile", "Discard Pile")}
          count={battleState.discard.length}
          type="discard"
          onInspect={() => onInspectPile("discard")}
          inspectable={inspectionAvailable}
        />
      </div>
    </section>
  );
}
