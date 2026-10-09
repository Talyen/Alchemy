import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setAlchemyVisit,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { readActivityData } from "@/lib/active-run-session";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import {
  createCampfirePotionOffers,
  getCampfireBrewKind,
  isBrewablePotion,
  type BrewOperation,
} from "@/lib/alchemist/brewing";
import { createTransmutationOffers, isTransmutableCard } from "@/lib/alchemist/transmutation";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { cloneBattleCard, computeTalentEffects, type BattleCard } from "@/lib/game-data";

export function initializeAlchemyVisit(kind: "campfire" | "transmutation", gameSession: GameSession): void {
  dispatchRunSessionCommand(
    (draft) => acceptCommand(initializeAlchemyVisitInTransaction(draft, kind)),
    undefined,
    gameSession,
  );
}

export function initializeAlchemyVisitInTransaction(draft: RunTransaction, kind: "campfire" | "transmutation"): void {
  const visit = readActivityData(snapshotTransactionValue(draft.session.activity), kind);
  if (draft.session.activity.kind === kind && (visit.offers.length || visit.completed)) return;
  const rng = createDraftRunRandomSource(draft, "events");
  setAlchemyVisit(draft, kind, {
    offers: kind === "campfire" ? createCampfirePotionOffers(rng) : createTransmutationOffers(rng),
    result: null,
    original: null,
    completed: false,
  });
}
export function brewAtCampfire(operation: BrewOperation, gameSession: GameSession): BattleCard | null {
  const brewed = dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "campfire" || draft.session.activity.data.completed)
        return rejectCommand("Alchemy action is unavailable", null);
      const visit = draft.session.activity.data;
      const deck = draft.run.activeRun.runDeck;
      if (operation.kind !== getCampfireBrewKind(snapshotTransactionValue(deck)))
        return rejectCommand("Alchemy action is unavailable", null);
      let result: BattleCard | null;
      if (operation.kind === "new") {
        const offer = visit.offers[operation.offerIndex];
        if (!offer) return rejectCommand("Alchemy action is unavailable", null);
        result = cloneBattleCard(snapshotTransactionValue(offer));
        appendCardToRunWithDiscovery(draft, result);
      } else if (operation.kind === "combine") {
        const [a, b] = operation.indices;
        if (a === b || !Number.isInteger(a) || !Number.isInteger(b))
          return rejectCommand("Alchemy action is unavailable", null);
        if (
          !deck[a] ||
          !deck[b] ||
          !isBrewablePotion(snapshotTransactionValue(deck[a])) ||
          !isBrewablePotion(snapshotTransactionValue(deck[b]))
        )
          return rejectCommand("Alchemy action is unavailable", null);
        result = tryCreateMixedPotion(
          snapshotTransactionValue(deck[a]),
          snapshotTransactionValue(deck[b]),
          computeTalentEffects(snapshotTransactionValue(draft.runProfile.unlockedTalents)).potionMixPotency,
        );
        if (!result) return rejectCommand("Alchemy action is unavailable", null);
        setRunDeck(draft, applyMixToDeck(snapshotTransactionValue(deck), a, b, result));
        discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
      } else return rejectCommand("Alchemy action is unavailable", null);
      setAlchemyVisit(draft, "campfire", { ...visit, result, completed: true });
      return acceptCommand(result);
    },
    undefined,
    gameSession,
  );
  if (brewed) sessionFeedback(gameSession).playUISound("campBrew");
  return brewed;
}
export function transmuteCard(sourceIndex: number, offerIndex: number, gameSession: GameSession): BattleCard | null {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "transmutation" || draft.session.activity.data.completed)
        return rejectCommand("Alchemy action is unavailable", null);
      const visit = draft.session.activity.data;
      const deck = draft.run.activeRun.runDeck;
      const original = deck[sourceIndex];
      const offer = visit.offers[offerIndex];
      if (
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(offerIndex) ||
        !original ||
        !offer ||
        !isTransmutableCard(snapshotTransactionValue(original)) ||
        original.id === offer.id
      )
        return rejectCommand("Alchemy action is unavailable", null);
      const result = cloneBattleCard(snapshotTransactionValue(offer));
      setRunDeck(
        draft,
        deck.map((card, index) => (index === sourceIndex ? result : card)),
      );
      discoverCardIds(draft, [result.id]);
      setAlchemyVisit(draft, "transmutation", { ...visit, original, result, completed: true });
      return acceptCommand(result);
    },
    undefined,
    gameSession,
  );
}
