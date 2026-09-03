import type { BattleState } from "@/lib/battle";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

const DOT_STATUSES = new Set(["burn", "poison", "bleed"]);
const CONTROL_STATUSES = new Set(["stun", "freeze"]);
const BLOCK_WEIGHT = 0.5;

function scoreEffects(effects: readonly BattleCardEffect[], state: BattleState): number {
  let total = 0;
  for (const effect of effects) {
    total += scoreEffect(effect, state);
  }
  return total;
}

function scoreEffect(effect: BattleCardEffect, state: BattleState): number {
  switch (effect.kind) {
    case "damage":
      return effect.amount;
    case "random-damage":
      return (effect.minAmount + effect.maxAmount) / 2;
    case "enemy-status":
      if (DOT_STATUSES.has(effect.status) || CONTROL_STATUSES.has(effect.status)) return effect.amount;
      return 0;
    case "player-status":
      if (effect.status === "block" || effect.status === "armor") return effect.amount * BLOCK_WEIGHT;
      return 0;
    case "heal":
      return state.playerHealth < state.playerMaxHealth ? effect.amount : 0;
    case "remove-harmful-status":
      return effect.amount * 3;
    case "chance":
      return (
        effect.probability * scoreEffects(effect.successEffects, state) +
        (1 - effect.probability) * scoreEffects(effect.failureEffects, state)
      );
    case "repeat-over-turns":
      return effect.remainingTurns * scoreEffects(effect.effects, state);
    case "draw-cards":
      return effect.amount * 2;
    case "restore-mana":
      return effect.amount * 2;
    case "summon-companion":
      return 6;
    case "buff-companion":
      return effect.amount * 2;
    case "multiply-enemy-status": {
      const current = state.enemyStatuses[effect.status] ?? 0;
      return current > 0 ? (effect.factor - 1) * current : 0;
    }
    case "remove-enemy-armor":
      return Math.min(effect.amount, state.enemyMitigation.armor);
    case "next-hit-crit":
      return 4;
    case "play-next-card-twice":
      return 5;
    case "wish":
      return 3;
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "remove-player-status":
    case "self-damage":
    case "lose-health":
    case "cleanse-player-status-to-damage":
    case "next-hit-poison":
    case "next-archery-free":
      return 0;
  }
}

export function getImmediateDamage(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind !== "damage") return total;
    return total + effect.amount;
  }, 0);
}

export function getImmediateDefense(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "heal") return total + effect.amount;
    if (effect.kind === "player-status" && (effect.status === "block" || effect.status === "armor")) {
      return total + effect.amount;
    }
    if (effect.kind === "remove-harmful-status") return total + effect.amount * 3;
    return total;
  }, 0);
}

export function getEffectiveDamageScore(card: BattleCard, state: BattleState): number {
  return scoreEffects(card.effects, state);
}

export function pickHighestScoring(
  playable: Array<{ card: BattleCard; index: number }>,
  scoreOf: (card: BattleCard) => number,
): { card: BattleCard; index: number } | null {
  const first = playable[0];
  if (!first) return null;
  let best = first;
  let bestScore = scoreOf(best.card);
  for (let i = 1; i < playable.length; i += 1) {
    const candidate = playable[i];
    if (!candidate) continue;
    const score = scoreOf(candidate.card);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return { card: best.card, index: best.index };
}
