import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { projectEnemyDotDamage } from "./dot-resolve";
import { scoreAvailableReactions } from "./reaction-score";
import { resolveConditionalCardDamage } from "./conditional-card-damage";
import type { BattleSnapshot } from "./types/state-types";
import {
  DAMAGE_TYPES,
  getCardKeywords,
  visitBattleCardEffects,
  harmfulPlayerStatusIds,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
} from "@/lib/game-data";
import { halveRounded, scalePercent } from "./amount-helpers";
import { getForgeBonusForDamage } from "./player-damage-base";
import { computeCardPayment } from "./card-cost-rules";
import { createCompanionActionCard } from "./companion-scaling";

import { AUTOPLAY_EFFECT_SCORE } from "./autoplay-weights";
import { nominalCardValue } from "./autoplay-draft-policy";
export { AUTOPLAY_EFFECT_SCORE } from "./autoplay-weights";

function scoreEffects(effects: readonly BattleCardEffect[], state: BattleSnapshot, manaRoom: number): number {
  let total = 0;
  for (const effect of effects) {
    total += scoreEffect(effect, state, manaRoom);
  }
  return total;
}

function averageForgeBonus(state: BattleSnapshot, damageTypes: readonly DamageType[]): number {
  if (damageTypes.length === 0) return 0;
  let total = 0;
  for (const type of damageTypes) total += getForgeBonusForDamage(state, type);
  return total / damageTypes.length;
}

function scoreDamageBase(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleSnapshot): number {
  if (effect.forgeBonusPercent !== undefined)
    return effect.amount + scalePercent(state.playerStatuses.forge, effect.forgeBonusPercent);
  if (effect.equalToBlock)
    return (
      scalePercent(state.playerStatuses.block, effect.equalToBlockPercent ?? 100) +
      getForgeBonusForDamage(state, effect.damageType)
    );
  if (effect.equalToArmor) return state.playerStatuses.armor + getForgeBonusForDamage(state, effect.damageType);
  if (effect.damageTypePool?.length) return effect.amount + averageForgeBonus(state, effect.damageTypePool);
  // Ordinary attacks include the usual Forge bonus like the live base pipeline;
  // explicit Forge scaling and equal-resource attacks already add it above.
  if (!effect.damageTypeIfTargetFrozen) return effect.amount + getForgeBonusForDamage(state, effect.damageType);
  const resolved = resolveConditionalCardDamage(effect, state.enemyCC.freezeSkipTurns > 0);
  return resolved.amount + getForgeBonusForDamage(state, resolved.damageType);
}

function scoreDamageEffect(effect: Extract<BattleCardEffect, { kind: "damage" }>, state: BattleSnapshot): number {
  const burning = state.enemyStatuses.burn > 0;
  const bleeding = state.enemyStatuses.bleed > 0;
  const bonus =
    Number(effect.doubleIfEnemyBleeding === true && bleeding) +
    (effect.tripleIfEnemyNotBurning === true && !burning ? 2 : 0);
  const base = scoreDamageBase(effect, state) * (1 + bonus);
  const detonation =
    (effect.detonateAllBurn ? projectEnemyDotDamage(state, "burn") : 0) +
    (effect.detonateAllBleed ? projectEnemyDotDamage(state, "bleed") : 0);
  return base + detonation;
}

function playerStatusAmount(
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  state: BattleSnapshot,
): number {
  if (effect.convertCurrentMana !== undefined) return state.mana * effect.convertCurrentMana;
  if (effect.perManaCrystal !== undefined) return state.maxMana * effect.perManaCrystal;
  return effect.amount;
}

function playerStatusDefense(
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  state: BattleSnapshot,
): number {
  const amount = playerStatusAmount(effect, state);
  if (!effect.statusPool) return effect.status === "block" || effect.status === "armor" ? amount : 0;
  let defensive = 0;
  for (const status of effect.statusPool) {
    if (status === "block" || status === "armor") defensive += 1;
  }
  return (amount * defensive) / effect.statusPool.length;
}

function activeCompanionEffects(state: BattleSnapshot): BattleCardEffect[] {
  return state.activeCompanion ? createCompanionActionCard(state, state.activeCompanion).effects : [];
}

function scoreEffect(effect: BattleCardEffect, state: BattleSnapshot, manaRoom: number): number {
  switch (effect.kind) {
    case "damage":
      return scoreDamageEffect(effect, state);
    case "random-damage": {
      const pool = effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES;
      return (effect.minAmount + effect.maxAmount) / 2 + averageForgeBonus(state, pool);
    }
    case "player-status":
      return playerStatusDefense(effect, state) * AUTOPLAY_EFFECT_SCORE.defense;
    case "heal":
      return Math.min(effect.amount, Math.max(0, state.playerMaxHealth - state.playerHealth));
    case "remove-harmful-status": {
      let removable = 0;
      for (const status of harmfulPlayerStatusIds) if (state.playerStatuses[status] > 0) removable += 1;
      const count = effect.removeAll ? removable : Math.min(effect.amount ?? 0, removable);
      return count * AUTOPLAY_EFFECT_SCORE.cleanse;
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
      return effect.amount * scoreEffects(activeCompanionEffects(state), state, manaRoom);
    case "multiply-enemy-status": {
      const current = state.enemyStatuses[effect.status] ?? 0;
      // Mirror the live pipeline's nearest-integer rounding so close picks agree.
      return current > 0 ? Math.round((effect.factor - 1) * current) : 0;
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
    case "cleanse-player-status-to-damage": {
      const stacks = state.playerStatuses[effect.status] ?? 0;
      return stacks > 0 ? stacks + getForgeBonusForDamage(state, effect.damageType) : 0;
    }
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

type ImmediateAccumulator = (total: number, effect: BattleCardEffect, state: BattleSnapshot) => number;

// Immediate estimates expand Chance and current Companion actions, but exclude
// delayed effects. Keep each branch's addition order stable for tied card picks.
function sumImmediateEffects(
  effects: readonly BattleCardEffect[],
  state: BattleSnapshot,
  accumulate: ImmediateAccumulator,
): number {
  return effects.reduce((total, effect) => {
    if (effect.kind === "chance")
      return (
        total +
        effect.probability * sumImmediateEffects(effect.successEffects, state, accumulate) +
        (1 - effect.probability) * sumImmediateEffects(effect.failureEffects, state, accumulate)
      );
    if (effect.kind === "companion-action")
      return total + effect.amount * sumImmediateEffects(activeCompanionEffects(state), state, accumulate);
    return accumulate(total, effect, state);
  }, 0);
}

function accumulateDamage(total: number, effect: BattleCardEffect, state: BattleSnapshot): number {
  if (effect.kind === "random-damage") {
    const pool = effect.damageTypePool?.length ? effect.damageTypePool : DAMAGE_TYPES;
    return total + (effect.minAmount + effect.maxAmount) / 2 + averageForgeBonus(state, pool);
  }
  return effect.kind === "damage" || effect.kind === "cleanse-player-status-to-damage"
    ? total + scoreEffect(effect, state, 0)
    : total;
}

function accumulateDefense(total: number, effect: BattleCardEffect, state: BattleSnapshot): number {
  if (effect.kind === "player-status") return total + playerStatusDefense(effect, state);
  if (effect.kind === "heal" || effect.kind === "remove-harmful-status" || effect.kind === "remove-player-status")
    return total + scoreEffect(effect, state, 0);
  if (effect.kind === "cleanse-player-status-to-damage")
    return total + (state.playerStatuses[effect.status] > 0 ? AUTOPLAY_EFFECT_SCORE.cleanse : 0);
  return effect.kind === "dodge-next-attack" ? total + (state.flags.dodgeNextAttack ? 0 : 1) : total;
}

export function getImmediateDamage(card: BattleCard, state?: BattleSnapshot): number {
  return state ? sumImmediateEffects(card.effects, state, accumulateDamage) : nominalCardValue(card.effects).damage;
}

export function getImmediateDefense(card: BattleCard, state?: BattleSnapshot): number {
  return state ? sumImmediateEffects(card.effects, state, accumulateDefense) : nominalCardValue(card.effects).defense;
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
    scoreAvailableReactions(card, { ...paid, mana: manaAfterPayment }, state.mana)
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
  return best;
}

interface SelfCostOutcome {
  health: number;
  phoenixFeather: boolean;
}

/** Conservatively ignore healing and mitigation, but spend death prevention once in effect order. */
function selfCostOutcomes(
  effects: readonly BattleCardEffect[],
  outcomes: SelfCostOutcome[],
  revivedHealth: number,
): SelfCostOutcome[] {
  for (const effect of effects) {
    if (effect.kind === "lose-health" || effect.kind === "self-damage") {
      outcomes = outcomes.map((outcome) => {
        if (outcome.health <= 0 || effect.amount <= 0) return outcome;
        if (effect.amount >= outcome.health && outcome.phoenixFeather) {
          return { health: revivedHealth, phoenixFeather: false };
        }
        return { ...outcome, health: Math.max(0, outcome.health - effect.amount) };
      });
    } else if (effect.kind === "chance") {
      const branches = [
        ...(effect.probability > 0 ? selfCostOutcomes(effect.successEffects, outcomes, revivedHealth) : []),
        ...(effect.probability < 1 ? selfCostOutcomes(effect.failureEffects, outcomes, revivedHealth) : []),
      ];
      // At most two meaningful worst cases: Feather retained or already spent.
      let withoutFeather: number | undefined;
      let withFeather: number | undefined;
      for (const branch of branches) {
        if (branch.phoenixFeather) withFeather = Math.min(withFeather ?? Infinity, branch.health);
        else withoutFeather = Math.min(withoutFeather ?? Infinity, branch.health);
      }
      outcomes = [];
      if (withoutFeather !== undefined) outcomes.push({ health: withoutFeather, phoenixFeather: false });
      if (withFeather !== undefined) outcomes.push({ health: withFeather, phoenixFeather: true });
    }
  }
  return outcomes;
}

export function hasPotentialLethalSelfCost(card: BattleCard, state: BattleSnapshot): boolean {
  // Feather revival ends Death's Door protection before any remaining costs.
  if (!state.deathsDoorUsed || (state.deathsDoorActive && state.playerStatuses.phoenixFeather <= 0)) return false;
  if (!visitBattleCardEffects(card.effects, (effect) => effect.kind === "lose-health" || effect.kind === "self-damage"))
    return false;
  const revivedHealth = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
  const first = selfCostOutcomes(
    card.effects,
    [{ health: state.playerHealth, phoenixFeather: state.playerStatuses.phoenixFeather > 0 }],
    revivedHealth,
  );
  if (first.some((outcome) => outcome.health <= 0)) return true;

  const keywords = getCardKeywords(card);
  const mayRepeat =
    state.flags.playNextCardTwice ||
    keywords.some((keyword) => {
      if (keyword === "burn") return state.talentEffects.burnCardPlayTwiceChance > 0;
      if (keyword === "freeze") return state.talentEffects.freezeCardPlayTwiceChance > 0;
      if (keyword === "nature") return state.talentEffects.natureCardPlayTwiceChance > 0;
      if (keyword === "poison") return state.talentEffects.poisonCardPlayTwiceChance > 0;
      if (keyword === "stun") return state.talentEffects.stunCardPlayTwiceChance > 0;
      if (keyword === "wish") return state.talentEffects.wishCardPlayTwiceChance > 0;
      return false;
    });
  return mayRepeat && selfCostOutcomes(card.effects, first, revivedHealth).some((outcome) => outcome.health <= 0);
}
