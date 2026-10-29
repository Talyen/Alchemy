import { deriveCombatMeta, rebindLiveRunMeta } from "../commands/write/live-meta";
import { battleSnapshot, resolveBattleStart, type BattleSnapshot } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { hasLegacyElusiveDodge } from "@/lib/game-data/cards/normalize-saved-definition";
import { createDraftRunRandomSource } from "../commands/run-session-write-port";
import { logError } from "@/lib/error-logger";
import type { GameplayDraft } from "../session/gameplay-command";

function hydrateBattleState(battleState: BattleSnapshot): BattleSnapshot {
  // Piles share guarded card-definition revisions with active-run decks while
  // retaining valid saved modifications. `pendingTurnStartEffects` (queued card effects + sourceCard)
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
  const legacyElusive = [
    snapshot.deck,
    snapshot.hand,
    snapshot.pendingHandCards,
    snapshot.discard,
    snapshot.exhausted,
  ].some((pile) => pile.some(hasLegacyElusiveDodge));
  let state = hydrateBattleState(snapshot);
  if (snapshot.flags.dodgeNextAttack && legacyElusive) {
    // The old Boolean has no card provenance. Restart this encounter rather than
    // guessing whether its charge came from Elusive or a native guaranteed Dodge.
    const run = draft.run.activeRun;
    const meta = deriveCombatMeta(draft);
    state = resolveBattleStart(
      {
        runDeck: run.runDeck.map(hydrateCard),
        gold: draft.runProfile.gold,
        totalRooms: run.roomsEncountered,
        currentEnemy: snapshot.currentEnemy,
        playerHealth: run.runPlayerHealth,
        maxHealth: run.runMaxHealth,
        talentEffects: meta.talentEffects,
        gearEffects: meta.gearEffects,
        trinketIds: meta.activeTrinketIds,
        discoveredCardIds: draft.profile.discoveredCardIds,
        difficultyModifiers: snapshot.difficultyModifiers,
        contentSystemType: snapshot.contentSystemType,
        encounterBenefits: snapshot.encounterBenefits,
        appliesFightPacing: snapshot.appliesFightPacing,
      },
      { rng: createDraftRunRandomSource(draft, "world") },
    ).state;
    logError("Restarted an incompatible battle with an unidentified legacy Elusive Dodge charge", "storage", {
      enemyId: snapshot.currentEnemy.id,
    });
  }
  draft.session.activity = { kind: "battle", data: { battleState: battleSnapshot(state) } };
  rebindLiveRunMeta(draft);
}
