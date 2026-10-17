import { scoreAvailableReactions } from "./reaction-score";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import type { BattleSnapshot } from "./types/state-types";
import {
  getModifiedCompanionEffects,
  harmfulPlayerStatusIds,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { halveRounded, scalePercent } from "./amount-helpers";
import { computeCardPayment } from "./card-cost-rules";
import { getBattleCompanionDamageModifiers } from "./companion-scaling";

// Live autoplay scoring. Game-design owned: changing these weights changes
// autoplay and Wish picks in real runs. The balance simulator imports this
// policy today so reports match the skill floor; if the simulator needs its own
// tuning, fork a copy under src/lib/balance instead of editing these weights.
export const AUTOPLAY_EFFECT_SCORE = {
  defense: 0.5,
  cleanse: 3,
  draw: 2,
  mana: 2,
  summon: 6,
  criticalHit: 4,
  repeatCard: 5,
  wish: 3,
} as const;

function scoreEffects(effects: readonly BattleCardEffect[], state: BattleSnapshot, manaRoom: number): number {
  let total = 0;
  for (const effect of effects) {
    total += scoreEffect(effect, state, manaRoom);
  }
  return total;
}

function scoreDamageBase(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleSnapshot): number {
  if (effect.forgeBonusPercent !== undefined)
    return effect.amount + scalePercent(state.playerStatuses.forge, effect.forgeBonusPercent);
  if (effect.equalToBlock) return scalePercent(state.playerStatuses.block, effect.equalToBlockPercent ?? 100);
  if (effect.equalToArmor) return state.playerStatuses.armor;
  // Ordinary attacks need no temporary resolved effect.
  if (!effect.damageTypeIfTargetFrozen) return effect.amount;
  return resolveConditionalCardDamage(effect, state.enemyCC.freezeSkipTurns > 0).amount;
}

function scoreDamageEffect(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleSnapshot): number {
  const burning = state.enemyStatuses.burn > 0;
  const bleeding = state.enemyStatuses.bleed > 0;
  const bonus =
    Number(effect.doubleIfEnemyBleeding === true && bleeding) +
    (effect.tripleIfEnemyNotBurning === true && !burning ? 2 : 0);
  return scoreDamageBase(effect, state) * (1 + bonus);
}

function playerStatusAmount(
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  state?: BattleSnapshot,
): number {
  // Without a snapshot, immediate-defense scoring uses the authored conversion factor.
  if (!state) return effect.convertCurrentMana ?? effect.perManaCrystal ?? effect.amount;
  if (effect.convertCurrentMana !== undefined) return state.mana * effect.convertCurrentMana;
  if (effect.perManaCrystal !== undefined) return state.maxMana * effect.perManaCrystal;
  return effect.amount;
}

function playerStatusDefense(
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  state?: BattleSnapshot,
): number {
  const amount = playerStatusAmount(effect, state);
  if (!effect.statusPool) return effect.status === "block" || effect.status === "armor" ? amount : 0;
  let defensive = 0;
  for (const status of effect.statusPool) {
    if (status === "block" || status === "armor") defensive += 1;
  }
  return (amount * defensive) / effect.statusPool.length;
}

function scoreEffect(effect: BattleCardEffect, state: BattleSnapshot, manaRoom: number): number {
  switch (effect.kind) {
    case "damage":
      return scoreDamageEffect(effect, state);
    case "random-damage":
      return (effect.minAmount + effect.maxAmount) / 2;
    case "player-status":
      return playerStatusDefense(effect, state) * AUTOPLAY_EFFECT_SCORE.defense;
    case "heal":
      return Math.min(effect.amount, Math.max(0, state.playerMaxHealth - state.playerHealth));
    case "remove-harmful-status": {
      // A full cleanse is worth the harmful effects actually present; a
      // fixed cleanse is worth its amount. Panacea Potion carries no amount.
      if (effect.removeAll) {
        let removable = 0;
        for (const status of harmfulPlayerStatusIds) if (state.playerStatuses[status] > 0) removable += 1;
        return removable * AUTOPLAY_EFFECT_SCORE.cleanse;
      }
      return (effect.amount ?? 0) * AUTOPLAY_EFFECT_SCORE.cleanse;
    }
    case "chance":
      return (
        effect.probability * scoreEffects(effect.successEffects, state, manaRoom) +
        (1 - effect.probability) * scoreEffects(effect.failureEffects, state, manaRoom)
      );
    case "repeat-over-turns":
      return effect.remainingTurns * scoreEffects(effect.effects, state, manaRoom);
    case "draw-cards":
      return Math.min(effect.amount, state.deck.length + state.discard.length) * AUTOPLAY_EFFECT_SCORE.draw;
    case "random-draw":
      return (
        Math.min((effect.minAmount + effect.maxAmount) / 2, state.deck.length + state.discard.length) *
        AUTOPLAY_EFFECT_SCORE.draw
      );
    case "restore-mana":
      return Math.min(effect.amount, effect.allowOverflow ? effect.amount : manaRoom) * AUTOPLAY_EFFECT_SCORE.mana;
    case "gain-max-mana":
      return effect.amount * AUTOPLAY_EFFECT_SCORE.mana;
    case "summon-companion":
      return AUTOPLAY_EFFECT_SCORE.summon;
    case "companion-action":
      return state.activeCompanion
        ? effect.amount *
            scoreEffects(
              getModifiedCompanionEffects(
                state.activeCompanion,
                state.talentEffects.companionBondLevels?.[state.activeCompanion.id] ?? 0,
                getBattleCompanionDamageModifiers(state),
              ),
              state,
              manaRoom,
            )
        : 0;
    case "multiply-enemy-status": {
      const current = state.enemyStatuses[effect.status] ?? 0;
      return current > 0 ? (effect.factor - 1) * current : 0;
    }
    case "remove-enemy-armor":
      return effect.halve
        ? state.enemyMitigation.armor - halveRounded(state.enemyMitigation.armor)
        : effect.removeAll
          ? state.enemyMitigation.armor
          : Math.min(effect.amount ?? 0, state.enemyMitigation.armor);
    case "next-hit-crit":
      return state.flags.nextHitCrit ? 0 : AUTOPLAY_EFFECT_SCORE.criticalHit;
    case "next-hit-leech":
      return 0;
    case "play-next-card-twice":
      return state.flags.playNextCardTwice ? 0 : AUTOPLAY_EFFECT_SCORE.repeatCard;
    case "wish":
      return effect.companionIfAbsent && state.activeCompanion ? 0 : effect.amount * AUTOPLAY_EFFECT_SCORE.wish;
    case "remove-player-status":
      return state.playerStatuses[effect.status] > 0 ? AUTOPLAY_EFFECT_SCORE.cleanse : 0;
    case "cleanse-player-status-to-damage":
      return state.playerStatuses[effect.status];
    case "lose-mana":
    case "lose-max-mana":
    case "gain-gold":
    case "self-damage":
    case "lose-health":
    case "next-hit-poison":
    case "next-archery-free":
    case "dodge-next-attack":
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

function immediateDefenseFromEffects(effects: readonly BattleCardEffect[], state?: BattleSnapshot): number {
  return effects.reduce((total, effect) => {
    if (effect.kind === "chance") {
      return (
        total +
        effect.probability * immediateDefenseFromEffects(effect.successEffects, state) +
        (1 - effect.probability) * immediateDefenseFromEffects(effect.failureEffects, state)
      );
    }
    if (effect.kind === "heal")
      return (
        total +
        (state ? Math.min(effect.amount, Math.max(0, state.playerMaxHealth - state.playerHealth)) : effect.amount)
      );
    if (effect.kind === "player-status") return total + playerStatusDefense(effect, state);
    if (effect.kind === "remove-harmful-status") {
      if (state && !harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0)) return total;
      // Stateless heuristic: a full cleanse counts nominally; fixed counts its amount.
      return total + (effect.amount ?? 1) * AUTOPLAY_EFFECT_SCORE.cleanse;
    }
    if (effect.kind === "remove-player-status") {
      return total + (!state || state.playerStatuses[effect.status] > 0 ? AUTOPLAY_EFFECT_SCORE.cleanse : 0);
    }
    if (effect.kind === "dodge-next-attack") return total + (state?.flags.dodgeNextAttack ? 0 : 1);
    return total;
  }, 0);
}

export function getImmediateDefense(card: BattleCard, state?: BattleSnapshot): number {
  return immediateDefenseFromEffects(card.effects, state);
}

export function getEffectiveDamageScore(card: BattleCard, state: BattleSnapshot): number {
  const { effectiveCost, blockCost } = computeCardPayment(state, card);
  const paid =
    blockCost > 0
      ? {
          ...state,
          playerStatuses: { ...state.playerStatuses, block: Math.max(0, state.playerStatuses.block - blockCost) },
        }
      : state;
  const manaAfterPayment = Math.max(0, state.mana - effectiveCost);
  return (
    scoreEffects(card.effects, paid, Math.max(0, state.maxMana - manaAfterPayment)) +
    scoreAvailableReactions(card, { ...paid, mana: manaAfterPayment })
  );
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
