import { visitBattleCardEffects, type BattleCard, type CompanionId } from "@/lib/game-data";

export function companionIdsFromDeck(deck: readonly BattleCard[]): CompanionId[] {
  const ids = new Set<CompanionId>();
  for (const card of deck) {
    visitBattleCardEffects(card.effects, (effect) => {
      if (effect.kind === "summon-companion") ids.add(effect.companionId);
    });
  }
  return [...ids];
}

export function removeCompanionSummonFromDeck(deck: readonly BattleCard[], companionId: CompanionId): BattleCard[] {
  return deck.filter(
    (card) =>
      !visitBattleCardEffects(
        card.effects,
        (effect) => effect.kind === "summon-companion" && effect.companionId === companionId,
      ),
  );
}
