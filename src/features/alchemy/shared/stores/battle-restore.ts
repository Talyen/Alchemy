import { current, isDraft } from "immer";
import { rebindLiveRunMeta } from "./write/live-meta";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import {
  battleSnapshot,
  isPlayerDefeated,
  processCompanionTurnStart,
  resolveBattleTurn,
  type BattleSnapshot,
} from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { GameplayDraft } from "./gameplay-command";
import { awardBattleDodgeXP } from "./write/run-progress";
import { commitResolvedBattle, withDraftWorldBattleRng } from "./write/run-battle";

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

/** Consume legacy work within hydration; live state never contains an unfinished legacy turn. */
export function restoreActiveBattle(
  draft: GameplayDraft,
  snapshot: BattleSnapshot | null,
  pending: PersistedBattleTransition | null = null,
): void {
  if (!snapshot) {
    if (draft.session.activity.kind === "battle") draft.session.activity = { kind: "idle" };
    return;
  }
  const before = battleSnapshot(hydrateBattleState(snapshot));
  draft.session.activity = {
    kind: "battle",
    data: { battleState: battleSnapshot(before), battleStartState: battleSnapshot(before) },
  };
  rebindLiveRunMeta(draft);
  if (!pending) return;
  // Saved result gold is relative to the saved input, not today's permanent purse.
  let state =
    "resultState" in pending
      ? battleSnapshot(hydrateBattleState(pending.resultState))
      : isDraft(draft.session.activity.data.battleState)
        ? current(draft.session.activity.data.battleState)
        : draft.session.activity.data.battleState;
  if ("resultState" in pending) state = { ...state, gold: draft.runProfile.gold + state.gold - before.gold };
  const input = { ...before, gold: draft.runProfile.gold };
  if (pending.kind === "continue-end-turn" || ("playerTurnSkipped" in pending && pending.playerTurnSkipped)) {
    const result = resolveBattleTurn(state, { rng: withDraftWorldBattleRng(draft, state).rng });
    awardBattleDodgeXP(draft, state, result.state);
    state = result.state;
  } else if (pending.kind === "enemy-turn" && state.enemyHealth > 0 && !isPlayerDefeated(state)) {
    state = battleSnapshot(processCompanionTurnStart(withDraftWorldBattleRng(draft, state), []));
  }
  commitResolvedBattle(draft, input, state);
  draft.session.activity.data.battleStartState = battleSnapshot(
    isDraft(draft.session.activity.data.battleState)
      ? current(draft.session.activity.data.battleState)
      : draft.session.activity.data.battleState,
  );
}
