import type { BattlePresentationStore } from "../../battle/battle-presentation-store";

import { cn } from "@/lib/utils";

import { ManaPanel, PilePanel } from "../../battle/presentation/ui/resources";
import { battleBottomBarClass, battleBottomColumnClass } from "@/features/alchemy/shared/config";
import { BossLyrics } from "./boss-lyrics";
import { BattleHand } from "./hand";
import type { BattleActionsProps, BattleRefsProps, RequiredBattleViewProps } from "./types";
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
    <section className={battleBottomBarClass} data-battle-bottom-bar>
      {battleState.currentEnemy.enemyType === "boss" ? <BossLyrics bossId={battleState.currentEnemy.id} /> : null}
      <div className={cn(battleBottomColumnClass, "justify-self-start")}>
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

      <div className="battle-hand-dock">
        <BattleHand
          presentation={presentation}
          view={view}
          refs={refs}
          actions={actions}
          playabilityState={playabilityState}
        />
        <ManaPanel mana={battleState.mana} maxMana={battleState.maxMana} presentation={presentation} />
      </div>

      <div className={cn(battleBottomColumnClass, "justify-self-end")}>
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
    </section>
  );
}
