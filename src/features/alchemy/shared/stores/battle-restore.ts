import { rebindLiveRunMeta } from "./write/live-meta";
import { battleSnapshot, type BattleSnapshot } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { GameplayDraft } from "./gameplay-command";

function hydrateBattleState(battleState: BattleSnapshot): BattleSnapshot {
  // Piles are re-hydrated against the card catalog so resumed battles pick up
  // catalog fixes. `pendingTurnStartEffects` (queued card effects + sourceCard)
  // is intentionally preserved as saved: those effects were already rolled and
  // mid-flight when the save was written, so re-hydrating them to the current
  // catalog would change the outcome of an in-flight turn.
  return {
    ...battleState,
    deck: battleState.deck.map(hydrateCard),
    hand: battleState.hand.map(hydrateCard),
    pendingHandCards: battleState.pendingHandCards.map(hydrateCard),
    discard: battleState.discard.map(hydrateCard),
    exhausted: battleState.exhausted.map(hydrateCard),
    wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
    wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
  };
}

export function restoreActiveBattle(draft: GameplayDraft, snapshot: BattleSnapshot | null): void {
  if (!snapshot) return;
  draft.session.activity = { kind: "battle", data: { battleState: battleSnapshot(hydrateBattleState(snapshot)) } };
  rebindLiveRunMeta(draft);
}
