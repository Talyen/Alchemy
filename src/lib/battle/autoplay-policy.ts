import type { BattleSnapshot } from "./types/state-types";
import { harmfulPlayerStatusIds, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

const DOT_STATUSES = new Set(["burn", "poison", "bleed"]);
const CONTROL_STATUSES = new Set(["stun", "freeze"]);
// Live autoplay scoring. Game-design owned: changing these weights changes
// autoplay and Wish picks in real runs. The balance simulator re-exports this
// policy today so reports match the skill floor; if the simulator needs its own
// tuning, fork a copy under src/lib/balance instead of editing these weights.
export const AUTOPLAY_EFFECT_SCORE = {
  defense: 0.5,
  cleanse: 3,
  draw: 2,
  mana: 2,
  summon: 6,
  companionBuff: 2,
  criticalHit: 4,
  repeatCard: 5,
  wish: 3,
} as const;

function scoreEffects(effects: readonly BattleCardEffect[], state: BattleSnapshot): number {
  let total = 0;
  for (const effect of effects) {
    total += scoreEffect(effect, state);
  }
  return total;
}

function scoreEffect(effect: BattleCardEffect, state: BattleSnapshot): number {
  switch (effect.kind) {
    case "damage":
      return effect.equalToForge ? state.playerStatuses.forge : effect.amount;
    case "random-damage":
      return (effect.minAmount + effect.maxAmount) / 2;
    case "enemy-status":
      if (DOT_STATUSES.has(effect.status) || CONTROL_STATUSES.has(effect.status)) return effect.amount;
      return 0;
    case "player-status":
      if (effect.status === "block" || effect.status === "armor") return effect.amount * AUTOPLAY_EFFECT_SCORE.defense;
      return 0;
    case "heal":
      return state.playerHealth < state.playerMaxHealth ? effect.amount : 0;
    case "remove-harmful-status": {
      // A full cleanse is worth the harmful effects actually present; a
      // fixed cleanse is worth its amount. Panacea Potion carries no amount.
      if (effect.removeAll) {
        const removable = harmfulPlayerStatusIds.filter((status) => state.playerStatuses[status] > 0).length;
        return removable * AUTOPLAY_EFFECT_SCORE.cleanse;
      }
      return (effect.amount ?? 0) * AUTOPLAY_EFFECT_SCORE.cleanse;
    }
    case "chance":
      return (
        effect.probability * scoreEffects(effect.successEffects, state) +
        (1 - effect.probability) * scoreEffects(effect.failureEffects, state)
      );
    case "repeat-over-turns":
      return effect.remainingTurns * scoreEffects(effect.effects, state);
    case "draw-cards":
      return effect.amount * AUTOPLAY_EFFECT_SCORE.draw;
    case "random-draw":
      return ((effect.minAmount + effect.maxAmount) / 2) * AUTOPLAY_EFFECT_SCORE.draw;
    case "restore-mana":
      return effect.amount * AUTOPLAY_EFFECT_SCORE.mana;
    case "summon-companion":
      return AUTOPLAY_EFFECT_SCORE.summon;
    case "buff-companion":
      return effect.amount * AUTOPLAY_EFFECT_SCORE.companionBuff;
    case "companion-action":
      return state.activeCompanion ? effect.amount * scoreEffects(state.activeCompanion.turnStartEffects, state) : 0;
    case "multiply-enemy-status": {
      const current = state.enemyStatuses[effect.status] ?? 0;
      return current > 0 ? (effect.factor - 1) * current : 0;
    }
    case "remove-enemy-armor":
      return effect.removeAll ? state.enemyMitigation.armor : Math.min(effect.amount ?? 0, state.enemyMitigation.armor);
    case "next-hit-crit":
      return AUTOPLAY_EFFECT_SCORE.criticalHit;
    case "next-hit-leech":
      return 0;
    case "play-next-card-twice":
      return AUTOPLAY_EFFECT_SCORE.repeatCard;
    case "wish":
      return AUTOPLAY_EFFECT_SCORE.wish;
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
    if (effect.kind === "damage") return total + effect.amount;
    if (effect.kind === "random-damage") return total + (effect.minAmount + effect.maxAmount) / 2;
    return total;
  }, 0);
}

export function getImmediateDefense(card: BattleCard): number {
  return card.effects.reduce((total, effect) => {
    if (effect.kind === "heal") return total + effect.amount;
    if (effect.kind === "player-status" && (effect.status === "block" || effect.status === "armor")) {
      return total + effect.amount;
    }
    if (effect.kind === "remove-harmful-status")
      // Stateless heuristic: a full cleanse counts nominally; fixed counts its amount.
      return total + (effect.amount ?? 1) * AUTOPLAY_EFFECT_SCORE.cleanse;
    return total;
  }, 0);
}

export function getEffectiveDamageScore(card: BattleCard, state: BattleSnapshot): number {
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
