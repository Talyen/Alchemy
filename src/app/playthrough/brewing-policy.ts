import { tryCreateMixedPotion } from "@/lib/alchemist";
import { isBrewablePotion, strengthenPotion } from "@/lib/alchemist/brewing";
import { getEffectiveDamageScore, type BattleSnapshot } from "@/lib/battle";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

// Visible-effect estimates for preparation, not combat predictions. Healing has
// future value here even at full Health; combat decisions use the live snapshot.
export function potionUtility(card: BattleCard): number {
  const value = (effect: BattleCardEffect): number => {
    switch (effect.kind) {
      case "damage":
        return effect.amount * (effect.damageType === "poison" ? 3 : 2);
      case "heal":
        return effect.amount * 0.75;
      case "restore-mana":
      case "draw-cards":
        return effect.amount * 2;
      case "gain-max-mana":
        return effect.amount * 5;
      case "wish":
        return effect.amount * 4;
      case "gain-gold":
        return effect.amount * 0.25;
      case "player-status":
        return effect.amount;
      case "remove-harmful-status":
        return effect.removeAll ? 3 : (effect.amount ?? 0);
      case "remove-enemy-armor":
        return 1;
      case "chance":
        return (
          effect.probability * effect.successEffects.reduce((sum, e) => sum + value(e), 0) +
          (1 - effect.probability) * effect.failureEffects.reduce((sum, e) => sum + value(e), 0)
        );
      case "repeat-over-turns":
        return effect.remainingTurns * effect.effects.reduce((sum, e) => sum + value(e), 0);
      case "random-draw":
      case "random-damage":
        return effect.minAmount + effect.maxAmount;
      case "buff-companion":
      case "cleanse-player-status-to-damage":
      case "companion-action":
      case "dodge-next-attack":
      case "enemy-status":
      case "lose-health":
      case "lose-mana":
      case "lose-max-mana":
      case "multiply-enemy-status":
      case "next-archery-free":
      case "next-hit-crit":
      case "next-hit-leech":
      case "next-hit-poison":
      case "play-next-card-twice":
      case "remove-player-status":
      case "self-damage":
      case "summon-companion":
        return 0;
    }
  };
  return card.effects.reduce((sum, effect) => sum + value(effect), 0) / Math.max(1, card.cost);
}

export interface BrewCandidate {
  kind: "mix" | "distill";
  indices: number[];
  result: BattleCard;
  improvement: number;
}

export function brewCandidates(deck: readonly BattleCard[], potency: number): BrewCandidate[] {
  const potions = deck.flatMap((card, index) => (isBrewablePotion(card) ? [{ card, index }] : []));
  const candidates: BrewCandidate[] = [];
  for (const { card, index } of potions) {
    const result = strengthenPotion(card);
    if (result)
      candidates.push({
        kind: "distill",
        indices: [index],
        result,
        improvement: potionUtility(result) - potionUtility(card),
      });
  }
  for (let a = 0; a < potions.length; a++)
    for (let b = a + 1; b < potions.length; b++) {
      const left = potions[a]!;
      const right = potions[b]!;
      const result = tryCreateMixedPotion(left.card, right.card, potency);
      if (!result) continue;
      // One draw/Mana resolves both ingredients. Compare against the better input,
      // and give compression one point, without pretending it is a measured win delta.
      const improvement = potionUtility(result) - Math.max(potionUtility(left.card), potionUtility(right.card)) + 1;
      candidates.push({ kind: "mix", indices: [left.index, right.index], result, improvement });
    }
  return candidates;
}

export function potionPurchaseScore(card: BattleCard, deck: readonly BattleCard[]): number {
  const count = deck.filter(isBrewablePotion).length;
  const value = potionUtility(card);
  const inferiorCopy = deck.some((owned) => owned.id === card.id && potionUtility(owned) > value);
  return count >= 4 || value <= 0 || inferiorCopy ? -1 : 1 + value / 10;
}

export function shouldPreserveConsumable(card: BattleCard, state: BattleSnapshot): boolean {
  if (!card.consume || getEffectiveDamageScore(card, state) > 0) return false;
  const t = state.talentEffects;
  const g = state.gearEffects;
  const last = state.hand.length === 1;
  const payoff =
    t.uncappedDrawOnConsume > 0 ||
    (t.drawOnConsume > 0 && !state.flags.consumeDrawUsedThisTurn) ||
    t.poisonOnConsume > 0 ||
    t.goldOnConsume > 0 ||
    (t.healOnConsume > 0 && state.playerHealth < state.playerMaxHealth) ||
    (last && t.forgeOnConsume > 0) ||
    ((t.consumeDetonatesBurn || t.consumeDetonatesBurnChance > 0) && state.enemyStatuses.burn > 0) ||
    g.armorOnConsume > 0 ||
    g.manaOnPaidConsume > 0 ||
    (g.poisonTickOnConsume > 0 && state.enemyStatuses.poison > 0) ||
    (last && g.drawOnLastHandConsume > 0) ||
    (g.holyOnConsumeWithoutMana > 0 && state.mana <= card.cost) ||
    state.trinketEffects.runicQuillDrawOnConsume > 0;
  return !payoff;
}
