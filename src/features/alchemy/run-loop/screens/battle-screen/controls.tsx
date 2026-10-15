import type { BattlePresentationStore } from "../../battle/battle-presentation-store";

import { battleBottomBarClass } from "@/features/alchemy/shared/config";
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
  const { handDockRef } = refs;

  return (
    <section className={battleBottomBarClass} data-battle-bottom-bar>
      {battleState.currentEnemy.enemyType === "boss" ? <BossLyrics bossId={battleState.currentEnemy.id} /> : null}
      <div ref={handDockRef} className="battle-hand-dock">
        <BattleHand
          presentation={presentation}
          view={view}
          refs={refs}
          actions={actions}
          playabilityState={playabilityState}
        />
      </div>
    </section>
  );
}
