import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setAlchemyVisit,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { readActivityData } from "@/lib/active-run-session";
import { cloneBattleCard } from "@/lib/game-data";
import { computeTalentEffects, type BattleCard } from "@/lib/game-data";
import { createCampfirePotionOffers, isBrewablePotion, type BrewOperation } from "@/lib/alchemist/brewing";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { createTransmutationOffers, isTransmutableCard } from "@/lib/alchemist/transmutation";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";

export function initializeAlchemyVisit(kind: "campfire" | "transmutation"): void {
  dispatchRunSessionCommand((draft) => {
    const visit = readActivityData(draft.session.activity, kind);
    if (draft.session.activity.kind === kind && (visit.offers.length || visit.completed)) return;
    const rng = createDraftRunRandomSource(draft, "events");
    setAlchemyVisit(draft, kind, {
      offers: kind === "campfire" ? createCampfirePotionOffers(rng) : createTransmutationOffers(rng),
      result: null,
      original: null,
      completed: false,
    });
  });
}
export function brewAtCampfire(operation: BrewOperation): BattleCard | null {
  return dispatchRunSessionCommand((draft) => {
    if (draft.session.activity.kind !== "campfire" || draft.session.activity.data.completed) return null;
    const visit = draft.session.activity.data;
    const deck = draft.run.activeRun.runDeck;
    let result: BattleCard | null;
    if (operation.kind === "new") {
      const offer = visit.offers[operation.offerIndex];
      if (!offer) return null;
      result = cloneBattleCard(offer);
      appendCardToRunWithDiscovery(draft, result);
    } else if (operation.kind === "combine") {
      const [a, b] = operation.indices;
      if (a === b || !Number.isInteger(a) || !Number.isInteger(b)) return null;
      if (!deck[a] || !deck[b] || !isBrewablePotion(deck[a]) || !isBrewablePotion(deck[b])) return null;
      result = tryCreateMixedPotion(
        deck[a],
        deck[b],
        computeTalentEffects(draft.runProfile.unlockedTalents).potionMixPotency,
      );
      if (!result) return null;
      setRunDeck(draft, applyMixToDeck(deck, a, b, result));
      discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
    } else return null;
    setAlchemyVisit(draft, "campfire", { ...visit, result, completed: true });
    return result;
  });
}
export function transmuteCard(sourceIndex: number, offerIndex: number): BattleCard | null {
  return dispatchRunSessionCommand((draft) => {
    if (draft.session.activity.kind !== "transmutation" || draft.session.activity.data.completed) return null;
    const visit = draft.session.activity.data;
    const deck = draft.run.activeRun.runDeck;
    const original = deck[sourceIndex];
    const offer = visit.offers[offerIndex];
    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(offerIndex) ||
      !original ||
      !offer ||
      !isTransmutableCard(original) ||
      original.id === offer.id
    )
      return null;
    const result = cloneBattleCard(offer);
    setRunDeck(
      draft,
      deck.map((card, index) => (index === sourceIndex ? result : card)),
    );
    discoverCardIds(draft, [result.id]);
    setAlchemyVisit(draft, "transmutation", { ...visit, original, result, completed: true });
    return result;
  });
}
