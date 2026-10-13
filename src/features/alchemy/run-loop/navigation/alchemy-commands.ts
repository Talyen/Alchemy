import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setAlchemyVisit, setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { getCampfireBrewKind, isBrewablePotion, type BrewOperation } from "@/lib/alchemist/brewing";
import {
  getTransmutationOffers,
  getTransmutationVariants,
  canTransmuteCard,
  isTransmutationSourceCurrent,
  isTransmutableCard,
} from "@/lib/alchemist/transmutation";
import type { TransmutationSelectionCommand } from "@/lib/active-run-session/alchemy-visits";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { cloneBattleCard, computeTalentEffects, type BattleCard } from "@/lib/game-data";

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
export function selectTransmutation(selection: TransmutationSelectionCommand, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "transmutation" || draft.session.activity.data.completed)
        return rejectCommand("Transmutation is unavailable", false);
      const visit = snapshotTransactionValue(draft.session.activity.data);
      const current = visit.transmutation;
      if (!current) return rejectCommand("Transmutation is unavailable", false);
      const deck = snapshotTransactionValue(draft.run.activeRun.runDeck);
      const next = { ...current };
      if (selection.kind === "source") {
        const source = deck[selection.index];
        if (
          !Number.isInteger(selection.index) ||
          !source ||
          !canTransmuteCard(current.choices, source, selection.index, deck) ||
          !isTransmutationSourceCurrent(
            { ...visit, transmutation: { ...current, sourceIndex: selection.index, source: selection.card } },
            deck,
          )
        )
          return rejectCommand("Card is no longer available", false);
        next.sourceIndex = selection.index;
        next.source = cloneBattleCard(source);
        const offers = getTransmutationOffers({ ...visit, transmutation: next });
        next.offerIndex = offers.findIndex((offer) =>
          canTransmuteCard(
            current.choices.filter((choice) => choice.keyword === offer.transmuted),
            source,
            selection.index,
            deck,
          ),
        );
        next.keyword = offers[next.offerIndex]!.transmuted!;
      } else if (selection.kind === "back") {
        next.keyword = null;
        next.offerIndex = null;
        next.sourceIndex = null;
        next.source = null;
      } else {
        if (!isTransmutationSourceCurrent(visit, deck)) return rejectCommand("Your deck changed", false);
        const offerIndex = getTransmutationOffers(visit).findIndex((card) => card.transmuted === selection.keyword);
        if (
          offerIndex < 0 ||
          !current.source ||
          !canTransmuteCard(
            current.choices.filter((choice) => choice.keyword === selection.keyword),
            current.source,
            current.sourceIndex ?? undefined,
            deck,
          )
        )
          return rejectCommand("Keyword is unavailable", false);
        next.keyword = selection.keyword;
        next.offerIndex = offerIndex;
      }
      setAlchemyVisit(draft, "transmutation", { ...visit, transmutation: next });
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
}

export function transmuteCard(sourceIndex: number, offerIndex: number, gameSession: GameSession): BattleCard | null {
  return dispatchRunSessionCommand(
    (draft) => {
      if (draft.session.activity.kind !== "transmutation" || draft.session.activity.data.completed)
        return rejectCommand("Alchemy action is unavailable", null);
      const visit = draft.session.activity.data;
      const deck = draft.run.activeRun.runDeck;
      const original = deck[sourceIndex];
      const snapshot = snapshotTransactionValue(visit);
      const offer = getTransmutationOffers(snapshot)[offerIndex];
      if (
        visit.transmutation?.sourceIndex !== sourceIndex ||
        visit.transmutation?.offerIndex !== offerIndex ||
        !isTransmutationSourceCurrent(snapshot, snapshotTransactionValue(deck)) ||
        !Number.isInteger(sourceIndex) ||
        !Number.isInteger(offerIndex) ||
        !original ||
        !offer ||
        !isTransmutableCard(snapshotTransactionValue(original)) ||
        original.id !== offer.id ||
        offer.transmuted !== visit.transmutation?.keyword ||
        !getTransmutationVariants(
          snapshotTransactionValue(original),
          offer.transmuted,
          snapshotTransactionValue(deck),
        ).some(
          (variant) =>
            variant.sourceKeyword ===
            snapshot.transmutation?.choices
              .find((choice) => choice.keyword === offer.transmuted)
              ?.alterations.find((alteration) => alteration.sourceIndex === sourceIndex)?.sourceKeyword,
        )
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
